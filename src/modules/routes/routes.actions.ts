"use server";

import requireAdmin from "@/utils/auth/requireAdmin";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/utils/supabase/getServerClient";
import { todayKeyAR } from "@/utils/dates/argentina";
import { DEPOT } from "@/modules/routes/routes.depot";
import {
    getRoadPath,
    optimizeStopOrder,
} from "@/modules/routes/routes.optimizer";
import { nextDayKey, pickFreeTrip } from "@/modules/routes/routes.utils";
import type {
    BusySlot,
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

function revalidateRoutesAndOrders() {
    revalidatePath("/admin/routes");
    revalidatePath("/admin/orders");
}

/**
 * Cambia fecha, choferes y vehículo de una ruta pendiente. Si cambia la fecha,
 * la base mueve todos sus pedidos al día nuevo (y elige otra vuelta si hace falta).
 */
export async function editRoute(
    input: EditRouteInput,
): Promise<{ tripNumber: number } | { error: string }> {
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

    const { data: tripNumber, error } = await supabase.rpc("edit_route", {
        p_route_id: routeId,
        p_new_date: date,
        p_driver_id: driverId,
        p_co_driver_id: coDriverId,
        p_vehicle_id: vehicleId,
    });

    if (error || tripNumber == null) {
        return {
            error:
                error?.code === "23505"
                    ? "Los choferes o el vehículo ya tienen una ruta en esa vuelta. Volvé a intentar."
                    : "No se pudo editar la ruta: " + (error?.message ?? "error desconocido"),
        };
    }

    revalidateRoutesAndOrders();

    return { tripNumber };
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
        .neq("state", "Cancelada")
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

    revalidateRoutesAndOrders();

    return { ok: true, routeDeleted: remaining.length === 0 };
}

// --- Conductor: ruta del día ---

type SetStopStateResult = { ok: true; state: "Pendiente" | "Completada" } | { error: string };

type StopWithRoute = {
  id: string;
  orderId: string;
  route: { driver_id: string } | null;
};

export async function setStopState(
  stopId: string,
  completed: boolean
): Promise<SetStopStateResult> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debés iniciar sesión para actualizar la parada." };
  }

  const { data: stop, error: stopError } = await supabase
    .from("stops")
    .select(`
      id,
      orderId:order_id,
      route:routes ( driver_id )
    `)
    .eq("id", stopId)
    .single();

  if (stopError || !stop) {
    return { error: "No se encontró la parada." };
  }

  const typedStop = stop as unknown as StopWithRoute;

  if (typedStop.route?.driver_id !== user.id) {
    return { error: "No tenés permisos para actualizar esta parada." };
  }

  const newStopState = completed ? "Completada" : "Pendiente";

  const { error: updateStopError } = await supabase
    .from("stops")
    .update({ state: newStopState })
    .eq("id", stopId);

  if (updateStopError) {
    return { error: "No se pudo actualizar la parada: " + updateStopError.message };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("state")
    .eq("id", stop.orderId)
    .single();

  if (order && order.state !== "Cancelada") {
    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({ state: newStopState })
      .eq("id", stop.orderId);

    if (updateOrderError) {
      return {
        error:
          "La parada se actualizó pero no se pudo sincronizar el pedido: " +
          updateOrderError.message,
      };
    }
  }

  revalidatePath("/driver");

  return { ok: true, state: newStopState };
}