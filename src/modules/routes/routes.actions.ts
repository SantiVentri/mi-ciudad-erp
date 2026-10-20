"use server";

import requireAdmin from "@/utils/auth/requireAdmin";
import { revalidatePath } from "next/cache";
import { todayKeyAR } from "@/utils/dates/argentina";
import { DEPOT } from "@/modules/routes/routes.depot";
import {
    getRoadPath,
    optimizeStopOrder,
} from "@/modules/routes/routes.optimizer";
import { nextDayKey, pickFreeTrip } from "@/modules/routes/routes.utils";
import type {
    BusySlot,
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
 * se pueden rutear y los que no tienen coordenadas, más las vueltas ocupadas.
 * Las fechas se guardan a medianoche UTC (igual que en las funciones de la base).
 */
async function loadDayData(supabase: AdminClient, date: string) {
    const dayStart = `${date}T00:00:00Z`;
    const dayEnd = `${nextDayKey(date)}T00:00:00Z`;

    const [ordersRes, routesRes] = await Promise.all([
        supabase
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
            .lt("arrival_date", dayEnd),
        supabase
            .from("routes")
            .select("trip_number, driver_id, co_driver_id, vehicle_id")
            .neq("state", "Cancelada")
            .gte("route_date", dayStart)
            .lt("route_date", dayEnd),
    ]);

    if (ordersRes.error || routesRes.error) {
        console.error(
            "Error cargando los datos del día:",
            ordersRes.error ?? routesRes.error,
        );
        return null;
    }

    const routable: RoutableOrder[] = [];
    const excluded: ExcludedOrder[] = [];

    for (const order of ordersRes.data ?? []) {
        // Mismo criterio que la base: una parada no cancelada significa que ya tiene ruta
        const hasRoute = (order.stops ?? []).some(
            (stop) => stop.state !== "Cancelada",
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

    const busySlots: BusySlot[] = routesRes.data ?? [];

    return { routable, excluded, busySlots };
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
            busySlots: dayData.busySlots,
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

    const tripNumber = pickFreeTrip(
        dayData.busySlots,
        driverId,
        coDriverId,
        vehicleId,
    );
    if (tripNumber === null) {
        return {
            error:
                "Los choferes o el vehículo ya tienen las dos vueltas ocupadas ese día.",
        };
    }

    const { ordered, optimized } = await optimizeStopOrder(
        DEPOT,
        dayData.routable,
    );

    // La base valida permisos, fecha, choferes activos, vuelta libre y pedidos libres
    const { data: routeId, error } = await supabase.rpc(
        "create_route_with_stops",
        {
            p_driver_id: driverId,
            p_co_driver_id: coDriverId,
            p_vehicle_id: vehicleId,
            p_route_date: date,
            p_trip_number: tripNumber,
            p_order_ids: ordered.map((order) => order.orderId),
        },
    );

    if (error || !routeId) {
        // 23505: otro admin creó una ruta con los mismos choferes/vehículo al mismo tiempo
        return {
            error:
                error?.code === "23505"
                    ? "Los choferes o el vehículo ya tienen una ruta en esa vuelta. Volvé a intentar."
                    : "No se pudo generar la ruta: " +
                        (error?.message ?? "error desconocido"),
        };
    }

    const { data: route } = await supabase
        .from("routes")
        .select("route_number")
        .eq("id", routeId)
        .single();

    revalidatePath("/admin/routes");
    revalidatePath("/admin/orders");

    return {
        result: {
            routeNumber: route?.route_number ?? null,
            tripNumber,
            stopsCount: ordered.length,
            excludedCount: dayData.excluded.length,
            optimized,
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
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para ver rutas." };
    }

    const { data: route, error } = await supabase
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
        .eq("id", routeId)
        .single();

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
