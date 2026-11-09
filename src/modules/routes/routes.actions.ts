"use server";

import requireAdmin from "@/utils/auth/requireAdmin";
import { getCurrentUser } from "@/utils/auth/getCurrentUser";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/utils/supabase/getServerClient";
import { todayKeyAR } from "@/utils/dates/argentina";
import { DEPOT } from "@/modules/routes/routes.depot";
import {
    getRoadPath,
    optimizeStopOrder,
} from "@/modules/routes/routes.optimizer";
import { nextDayKey } from "@/modules/routes/routes.utils";
import { refreshRouteEstimateSafely } from "@/modules/costs/costs.estimate";
import { COSTS_PATH } from "@/modules/costs/costs.constants";
import type {
    EditRouteInput,
    ExcludedOrder,
    GenerateRouteInput,
    GenerateRouteResult,
    RouteGenerationPreview,
} from "@/modules/routes/routes.types";

type AdminClient = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>;

type RoutableOrder = {
    orderId: string;
    latitude: number;
    longitude: number;
};

function validateRouteDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return "La fecha no es válida.";
    }
    if (date < todayKeyAR()) {
        return "No se pueden generar rutas para días pasados.";
    }
    return null;
}

/**
 * Pedidos pendientes del día que no están en ninguna ruta, separados en los que
 * se pueden rutear y los que no tienen coordenadas.
 * Las fechas se guardan a medianoche UTC (igual que en las funciones de la base).
 */
async function loadDayData(supabase: AdminClient, date: string) {
    const dayStart = `${date}T00:00:00Z`;
    const dayEnd = `${nextDayKey(date)}T00:00:00Z`;

    const { data: dayOrders, error } = await supabase
        .from("orders")
        .select(
            `
                id,
                client:clients ( name, street, number, city, latitude, longitude ),
                stops ( id, state )
            `,
        )
        .eq("state", "Pendiente")
        .gte("arrival_date", dayStart)
        .lt("arrival_date", dayEnd);

    if (error) {
        console.error("Error cargando los pedidos del día:", error);
        return null;
    }

    const routable: RoutableOrder[] = [];
    const excluded: ExcludedOrder[] = [];

    for (const order of dayOrders ?? []) {
        // Mismo criterio que la base: una parada no cancelada ni fallida significa que ya tiene ruta
        const hasRoute = (order.stops ?? []).some(
            (stop) => stop.state !== "Cancelada" && stop.state !== "Entrega fallida",
        );
        if (hasRoute) continue;

        const client = order.client;
        if (client?.latitude != null && client?.longitude != null) {
            routable.push({
                orderId: order.id,
                latitude: Number(client.latitude),
                longitude: Number(client.longitude),
            });
        } else {
            excluded.push({
                orderId: order.id,
                clientName: client?.name ?? "Cliente eliminado",
                address: client
                    ? `${client.street} ${client.number}, ${client.city}`
                    : "Sin dirección",
            });
        }
    }

    return { routable, excluded };
}

export async function getRouteGenerationPreview(
    date: string,
): Promise<{ preview: RouteGenerationPreview } | { error: string }> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para generar rutas." };
    }

    const dateError = validateRouteDate(date);
    if (dateError) {
        return { error: dateError };
    }

    const dayData = await loadDayData(supabase, date);
    if (!dayData) {
        return { error: "No se pudieron cargar los pedidos del día." };
    }

    return {
        preview: {
            date,
            ordersCount: dayData.routable.length,
            excluded: dayData.excluded,
        },
    };
}

export async function generateRoute(
    input: GenerateRouteInput,
): Promise<{ result: GenerateRouteResult } | { error: string }> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para generar rutas." };
    }

    const { date, driverId, coDriverId, vehicleId } = input;

    const dateError = validateRouteDate(date);
    if (dateError) {
        return { error: dateError };
    }

    if (!driverId || !coDriverId || !vehicleId) {
        return { error: "Elegí el conductor, el acompañante y el vehículo." };
    }

    if (driverId === coDriverId) {
        return { error: "El conductor y el acompañante deben ser distintos." };
    }

    // Se vuelve a leer todo: puede haber cambiado desde que se abrió el modal
    const dayData = await loadDayData(supabase, date);
    if (!dayData) {
        return { error: "No se pudieron cargar los pedidos del día." };
    }

    if (dayData.routable.length === 0) {
        return {
            error:
                dayData.excluded.length > 0
                    ? "Los pedidos sin ruta de este día no tienen ubicación cargada."
                    : "No hay pedidos pendientes sin ruta para este día.",
        };
    }

    const { ordered, optimized } = await optimizeStopOrder(
        DEPOT,
        dayData.routable,
    );

    // La base valida permisos, fecha, choferes activos y pedidos libres
    const { data: routeId, error } = await supabase.rpc(
        "create_route_with_stops",
        {
            p_driver_id: driverId,
            p_co_driver_id: coDriverId,
            p_vehicle_id: vehicleId,
            p_route_date: date,
            p_order_ids: ordered.map((order) => order.orderId),
        },
    );

    if (error || !routeId) {
        return {
            error: "No se pudo generar la ruta: " + (error?.message ?? "error desconocido"),
        };
    }

    const { data: route } = await supabase
        .from("routes")
        .select("route_number")
        .eq("id", routeId)
        .single();

    // Si el costo no se puede calcular (falta un sueldo, el rendimiento, etc.),
    // la ruta queda creada igual y se avisa qué cargar
    const costWarning = await refreshRouteEstimateSafely(supabase, routeId);

    revalidatePath("/admin/routes");
    revalidatePath("/admin/orders");
    revalidatePath(COSTS_PATH);

    return {
        result: {
            routeNumber: route?.route_number ?? null,
            stopsCount: ordered.length,
            excludedCount: dayData.excluded.length,
            optimized,
            costWarning,
        },
    };
}

/**
 * Recorrido por calles de una ruta: depósito → paradas en orden → depósito.
 * path es null si OpenRouteService no respondió (el mapa dibuja líneas rectas).
 */
export async function getRoutePath(
    routeId: string,
): Promise<{ path: [number, number][] | null } | { error: string }> {
    // El admin ve cualquier ruta; el conductor, solo las suyas (como chofer o acompañante)
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "driver")) {
        return { error: "No tenés permisos para ver rutas." };
    }

    const supabase = await getServerClient();

    let query = supabase
        .from("routes")
        .select(
            `
                id,
                stops (
                    visit_order,
                    order:orders ( client:clients ( latitude, longitude ) )
                )
            `,
        )
        .eq("id", routeId);

    if (user.role === "driver") {
        query = query.or(`driver_id.eq.${user.id},co_driver_id.eq.${user.id}`);
    }

    const { data: route, error } = await query.single();

    if (error || !route) {
        return { error: "No se encontró la ruta." };
    }

    const stopPoints = [...(route.stops ?? [])]
        .sort((a, b) => a.visit_order - b.visit_order)
        .map((stop) => stop.order?.client)
        .filter(
            (client): client is { latitude: number; longitude: number } =>
                client?.latitude != null && client?.longitude != null,
        )
        .map((client) => ({
            latitude: Number(client.latitude),
            longitude: Number(client.longitude),
        }));

    if (stopPoints.length === 0) {
        return { path: null };
    }

    const path = await getRoadPath([DEPOT, ...stopPoints, DEPOT]);

    return { path };
}

function revalidateRoutesAndOrders() {
    revalidatePath("/admin/routes");
    revalidatePath("/admin/orders");
    revalidatePath(COSTS_PATH);
}

/**
 * Cambia fecha, choferes y vehículo de una ruta pendiente. Si cambia la fecha,
 * la base mueve todos sus pedidos al día nuevo.
 */
export async function editRoute(
    input: EditRouteInput,
): Promise<{ ok: true } | { error: string }> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para editar rutas." };
    }

    const { routeId, date, driverId, coDriverId, vehicleId } = input;

    const dateError = validateRouteDate(date);
    if (dateError) {
        return { error: dateError };
    }

    if (!driverId || !coDriverId || !vehicleId) {
        return { error: "Elegí el conductor, el acompañante y el vehículo." };
    }

    if (driverId === coDriverId) {
        return { error: "El conductor y el acompañante deben ser distintos." };
    }

    const { error } = await supabase.rpc("edit_route", {
        p_route_id: routeId,
        p_new_date: date,
        p_driver_id: driverId,
        p_co_driver_id: coDriverId,
        p_vehicle_id: vehicleId,
    });

    if (error) {
        return { error: "No se pudo editar la ruta: " + error.message };
    }

    // Cambiaron choferes, vehículo o fecha: el costo anterior ya no corresponde
    const costWarning = await refreshRouteEstimateSafely(supabase, routeId);
    if (costWarning) {
        console.warn("Ruta editada sin costo actualizado", routeId, costWarning);
    }

    revalidateRoutesAndOrders();

    return { ok: true };
}

// Borra una ruta pendiente: sus pedidos vuelven a "Pendiente"
export async function deleteRoute(routeId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para borrar rutas." };
    }

    const { error } = await supabase.rpc("delete_route", { p_route_id: routeId });

    if (error) {
        return { error: "No se pudo borrar la ruta: " + error.message };
    }

    revalidateRoutesAndOrders();

    return { ok: true };
}

// Saca un pedido de la ruta (vuelve a "Pendiente"). Si era el último, la ruta se borra.
export async function removeOrderFromRoute(routeId: string, orderId: string) {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para editar rutas." };
    }

    const { data: stops, error: stopsError } = await supabase
        .from("stops")
        .select("order_id, visit_order")
        .eq("route_id", routeId)
        .not("state", "in", '("Cancelada","Entrega fallida")')
        .order("visit_order", { ascending: true });

    if (stopsError) {
        return { error: "No se pudieron leer las paradas de la ruta." };
    }

    // Se mantiene el orden de las paradas que quedan
    const remaining = (stops ?? [])
        .map((stop) => stop.order_id)
        .filter((id) => id !== orderId);

    const { error } = await supabase.rpc("set_route_stops", {
        p_route_id: routeId,
        p_order_ids: remaining,
    });

    if (error) {
        return { error: "No se pudo quitar el pedido: " + error.message };
    }

    // Cambiaron las paradas: se recalcula el recorrido y el costo
    if (remaining.length > 0) {
        const costWarning = await refreshRouteEstimateSafely(supabase, routeId);
        if (costWarning) {
            console.warn("Pedido quitado sin costo actualizado", routeId, costWarning);
        }
    }

    revalidateRoutesAndOrders();

    return { ok: true, routeDeleted: remaining.length === 0 };
}

// --- Conductor: ruta del día ---

export type StopState = "Pendiente" | "Completada" | "Entrega fallida";

type SetStopStateResult = { ok: true; state: StopState } | { ok: false; error: string };

// La base valida que sea el conductor o el acompañante de la ruta y sincroniza
// el pedido (Completada / Asignada / Pendiente si la entrega falló)
export async function setStopState(
  stopId: string,
  newState: StopState
): Promise<SetStopStateResult> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debés iniciar sesión para actualizar la parada." };
  }

  const { error } = await supabase.rpc("set_stop_state", {
    p_stop_id: stopId,
    p_state: newState,
  });

  if (error) {
    return { ok: false, error: "No se pudo actualizar la parada: " + error.message };
  }

  revalidatePath("/driver");
  revalidateRoutesAndOrders();

  return { ok: true, state: newState };
}

// El conductor sale del depósito: la ruta pasa a "En curso" y se registra started_at
export async function startRoute(
  routeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();

  if (!user || user.role !== "driver") {
    return { ok: false, error: "Iniciá sesión como conductor para iniciar la ruta." };
  }

  const supabase = await getServerClient();

  const { error } = await supabase.rpc("start_route_by_driver", {
    p_route_id: routeId,
  });

  if (error) {
    return { ok: false, error: "No se pudo iniciar la ruta: " + error.message };
  }

  revalidatePath("/driver");
  revalidatePath(`/driver/routes/${routeId}`);
  revalidateRoutesAndOrders();

  return { ok: true };
}

export async function setCompletedRoute(
  routeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debés iniciar sesión para finalizar la ruta." };
  }

  const { error } = await supabase.rpc("complete_route_by_driver", {
    p_route_id: routeId,
  });

  if (error) {
    return { ok: false, error: "No se pudo finalizar la ruta: " + error.message };
  }

  revalidatePath("/driver");
  revalidateRoutesAndOrders();

  return { ok: true };
}
