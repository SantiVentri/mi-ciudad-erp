import "server-only";
import { DEPOT } from "@/modules/routes/routes.depot";
import { getRouteMetrics, type GeoPoint, type OrsFailure } from "@/modules/routes/routes.optimizer";
import { STOP_SERVICE_MINUTES } from "@/modules/costs/costs.constants";
import type { DbClient } from "@/modules/costs/costs.types";

// Helpers internos: reciben un cliente de admin ya validado. No son Server Actions,
// así que no se pueden invocar desde el navegador.

type PostgrestLikeError = { message: string; hint?: string | null; code?: string | null };

// Mensajes de estimate_route_cost que ya dicen qué cargar (ver HINT en la migración)
const ACTIONABLE_HINTS = new Set([
    "missing_km_per_liter",
    "missing_fuel_price",
    "missing_salary",
    "invalid_input",
    "not_found",
]);

// Mensajes de la versión original de estimate_route_cost (20261109000000), que no
// trae HINT y nombra todo por UUID. Se traducen mientras la base no tenga la
// versión de 20261109120000_costs_module_hardening.
const LEGACY_MESSAGES: { pattern: RegExp; message: (match: RegExpMatchArray) => string }[] = [
    {
        pattern: /^El vehículo .+ no tiene km_per_liter cargado$/,
        message: () =>
            "El vehículo de la ruta no tiene cargado el rendimiento (km por litro). Cargalo en Transportes.",
    },
    {
        pattern: /^No hay precio de combustible vigente para (\d{4})-(\d{2})-(\d{2})$/,
        message: ([, year, month, day]) =>
            `No hay precio de combustible vigente para el ${day}/${month}/${year}. Cargalo en Costos › Combustible.`,
    },
    {
        pattern: /^El conductor .+ no tiene sueldo vigente/,
        message: () =>
            "El conductor de la ruta no tiene sueldo vigente para esa fecha. Cargalo en Costos › Sueldos.",
    },
    {
        pattern: /^El acompañante .+ no tiene sueldo vigente/,
        message: () =>
            "El acompañante de la ruta no tiene sueldo vigente para esa fecha. Cargalo en Costos › Sueldos.",
    },
];

export function describeEstimateError(error: PostgrestLikeError) {
    if (error.hint && ACTIONABLE_HINTS.has(error.hint)) {
        return `${error.message}.`;
    }
    if (error.code === "42501") {
        return "No tenés permisos para calcular costos.";
    }
    for (const legacy of LEGACY_MESSAGES) {
        const match = error.message.match(legacy.pattern);
        if (match) return legacy.message(match);
    }
    // P0001: RAISE EXCEPTION propio de la función, pensado para leerse
    if (error.code === "P0001") {
        return `${error.message}.`;
    }
    return "No se pudo calcular el costo por un error inesperado. Probá de nuevo con Recalcular costo.";
}

/**
 * Guarda km y minutos estimados en la ruta y calcula su costo con los precios y
 * sueldos vigentes en la fecha de la ruta. Si falta algún dato, los km y minutos
 * quedan guardados, se borra un costo viejo (ya no corresponde) y se devuelve
 * qué cargar.
 */
export async function saveRouteEstimateWithClient(
    supabase: DbClient,
    routeId: string,
    distanceKm: number,
    durationMin: number,
): Promise<{ ok: true } | { error: string }> {
    const { data: route, error: updateError } = await supabase
        .from("routes")
        .update({
            estimated_distance_km: distanceKm,
            estimated_duration_min: Math.round(durationMin),
        })
        .eq("id", routeId)
        .select("vehicle_id, driver_id, co_driver_id, route_date")
        .single();

    if (updateError || !route) {
        console.error("Error guardando la estimación de la ruta:", updateError);
        return { error: "No se pudo guardar la distancia y la duración estimadas de la ruta." };
    }

    const { data: cost, error: estimateError } = await supabase
        .rpc("estimate_route_cost", {
            p_vehicle_id: route.vehicle_id,
            p_driver_id: route.driver_id,
            // La función acepta NULL (ruta sin acompañante), pero los tipos generados
            // marcan todos los argumentos como string. Hay que mandar null: si se omite,
            // PostgREST no encuentra la función porque el parámetro no tiene default.
            p_co_driver_id: route.co_driver_id as string,
            p_distance_km: distanceKm,
            p_duration_min: Math.round(durationMin),
            p_on_date: route.route_date.slice(0, 10),
        })
        .single();

    if (estimateError || !cost) {
        console.error("No se pudo estimar el costo de la ruta", routeId, estimateError);
        await supabase.from("route_costs").delete().eq("route_id", routeId);
        return {
            error: estimateError
                ? describeEstimateError(estimateError)
                : "No se pudo calcular el costo de la ruta.",
        };
    }

    const { error: saveError } = await supabase.from("route_costs").upsert({
        route_id: routeId,
        estimated_fuel_cost: cost.fuel_cost,
        estimated_labor_cost: cost.labor_cost,
    });

    if (saveError) {
        console.error("Error guardando el costo de la ruta:", saveError);
        return { error: "Se calculó el costo, pero no se pudo guardar. Probá de nuevo con Recalcular costo." };
    }

    return { ok: true };
}

/**
 * Calcula km y minutos por calles (depósito → paradas → depósito) con el proveedor
 * de ruteo, suma el tiempo de descarga por parada y guarda la estimación.
 */
const RETRY_HINT = "Probá más tarde con Recalcular costo en Costos › Rutas.";

const ORS_FAILURE_MESSAGES: Record<OrsFailure, string> = {
    quota: `Se agotó el cupo gratuito de OpenRouteService, así que no se pudo calcular la distancia por calles. El cupo se renueva solo. ${RETRY_HINT}`,
    missing_key:
        "Falta configurar ORS_API_KEY en el servidor, así que no se puede calcular la distancia por calles.",
    unavailable: `OpenRouteService no respondió y no se pudo calcular la distancia por calles. ${RETRY_HINT}`,
};

export async function refreshRouteEstimate(
    supabase: DbClient,
    routeId: string,
): Promise<{ ok: true } | { error: string }> {
    const { data: route, error } = await supabase
        .from("routes")
        .select(
            `
                id,
                stops (
                    visit_order,
                    state,
                    order:orders ( client:clients ( latitude, longitude ) )
                )
            `,
        )
        .eq("id", routeId)
        .single();

    if (error || !route) {
        console.error("Error leyendo las paradas para estimar la ruta:", error);
        return { error: "No se pudieron leer las paradas de la ruta para estimar su costo." };
    }

    const activeStops = [...(route.stops ?? [])]
        .filter((stop) => stop.state !== "Cancelada" && stop.state !== "Entrega fallida")
        .sort((a, b) => a.visit_order - b.visit_order);

    const points: GeoPoint[] = activeStops
        .map((stop) => stop.order?.client)
        .filter(
            (client): client is { latitude: number; longitude: number } =>
                client?.latitude != null && client?.longitude != null,
        )
        .map((client) => ({ latitude: Number(client.latitude), longitude: Number(client.longitude) }));

    if (points.length === 0) {
        return { error: "La ruta no tiene paradas con ubicación, así que no se puede estimar su recorrido." };
    }

    const result = await getRouteMetrics([DEPOT, ...points, DEPOT]);
    if ("failure" in result) {
        return { error: ORS_FAILURE_MESSAGES[result.failure] };
    }
    const { metrics } = result;

    const durationMin = metrics.durationMin + STOP_SERVICE_MINUTES * activeStops.length;

    return saveRouteEstimateWithClient(supabase, routeId, metrics.distanceKm, durationMin);
}

/**
 * Igual que refreshRouteEstimate, pero nunca lanza: la operación que la llama
 * (crear o editar una ruta) no tiene que fallar por el costo.
 * Devuelve el aviso para el admin, o null si salió bien.
 */
export async function refreshRouteEstimateSafely(
    supabase: DbClient,
    routeId: string,
): Promise<string | null> {
    try {
        const result = await refreshRouteEstimate(supabase, routeId);
        return "error" in result ? result.error : null;
    } catch (error) {
        console.error("Error inesperado estimando el costo de la ruta", routeId, error);
        return "No se pudo calcular el costo por un error inesperado. Probá de nuevo con Recalcular costo en Costos › Rutas.";
    }
}
