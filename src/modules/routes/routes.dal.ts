import "server-only";
import { cache } from "react";
import { getServerClient } from "@/utils/supabase/getServerClient";
import { assertNoSupabaseError } from "@/utils/supabase/assertNoError";
import { dayKey, parseDateOnly } from "@/modules/orders/orders.utils";
import { todayAR } from "@/utils/dates/argentina";
import type { DayOrdersStatus } from "@/modules/routes/routes.types";

const METRICS_WINDOW_DAYS = 30;
const CHART_DAYS = 14;
// Mismos días hacia adelante que muestra la pantalla (DAYS_AFTER). Se acota la ventana
// porque PostgREST corta en silencio a 1000 filas y, sin tope, el conteo saldría mal.
const UNASSIGNED_WINDOW_DAYS = 8;

export const getAdminRoutes = cache(async (startDate: string, endDate: string) => {
    const supabase = await getServerClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
        .from("routes")
        .select(
            `
                id,
                route_number,
                trip_number,
                route_date,
                state,
                created_at,
                driver:profiles!routes_driver_id_fkey ( id, first_name, last_name, email, phone ),
                co_driver:profiles!routes_co_driver_id_fkey ( id, first_name, last_name, email, phone ),
                vehicle:vehicles ( id, patent ),
                stops (
                    id,
                    visit_order,
                    state,
                    order:orders (
                        id,
                        arrival_date,
                        state,
                        client:clients (
                            id, name, phone, street, number, city, province,
                            latitude, longitude, observations
                        ),
                        order_details ( id, quantity, product:products ( id, name ) )
                    )
                )
            `,
        )
        .gte("route_date", startDate)
        .lte("route_date", endDate)
        .order("route_date", { ascending: true })
        .order("route_number", { ascending: true })
        .order("visit_order", { referencedTable: "stops", ascending: true });

    assertNoSupabaseError(error, "Error trayendo las rutas");

    return data;
});

export type AdminRoutes = NonNullable<Awaited<ReturnType<typeof getAdminRoutes>>>;
export type AdminRoute = AdminRoutes[number];
export type AdminRouteStop = AdminRoute["stops"][number];

// Por día: cuántos pedidos hay y cuántos siguen "Pendiente" (sin ruta)
export const getOrdersStatusByDay = cache(async (startDate: string, endDate: string) => {
    const supabase = await getServerClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("orders")
        .select("arrival_date, state")
        .gte("arrival_date", startDate)
        .lte("arrival_date", endDate);

    assertNoSupabaseError(error, "Error trayendo los pedidos por día");

    const byDay: Record<string, DayOrdersStatus> = {};
    for (const order of data ?? []) {
        const key = dayKey(parseDateOnly(order.arrival_date));
        const entry = byDay[key] ?? { total: 0, pending: 0 };
        entry.total += 1;
        if (order.state === "Pendiente") entry.pending += 1;
        byDay[key] = entry;
    }

    return byDay;
});

export const getRoutesMetrics = cache(async () => {
    const supabase = await getServerClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const today = todayAR();
    const todayKey = dayKey(today);

    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - (METRICS_WINDOW_DAYS - 1));

    // Límite exclusivo: el día siguiente al último día de la ventana
    const unassignedEnd = new Date(today);
    unassignedEnd.setDate(unassignedEnd.getDate() + UNASSIGNED_WINDOW_DAYS + 1);

    const [routesRes, ordersRes] = await Promise.all([
        supabase
            .from("routes")
            .select("id, route_date, state, stops ( id )")
            .gte("route_date", dayKey(windowStart))
            .lte("route_date", todayKey),
        supabase
            .from("orders")
            .select("id, stops ( id, route:routes ( state ) )")
            .eq("state", "Pendiente")
            .gte("arrival_date", todayKey)
            .lt("arrival_date", dayKey(unassignedEnd)),
    ]);

    assertNoSupabaseError(
        routesRes.error,
        "Error trayendo las métricas de rutas",
    );
    assertNoSupabaseError(ordersRes.error, "Error trayendo los pedidos sin ruta");

    // Las rutas canceladas no cuentan para ninguna métrica
    const activeRoutes = (routesRes.data ?? []).filter(
        (route) => route.state !== "Cancelada",
    );

    const byDay = new Map<string, { routes: number; stops: number }>();
    for (const route of activeRoutes) {
        const key = dayKey(parseDateOnly(route.route_date));
        const entry = byDay.get(key) ?? { routes: 0, stops: 0 };
        entry.routes += 1;
        entry.stops += route.stops?.length ?? 0;
        byDay.set(key, entry);
    }

    const totalStops = activeRoutes.reduce(
        (sum, route) => sum + (route.stops?.length ?? 0),
        0,
    );
    const daysWithRoutes = byDay.size;

    const routesToday = byDay.get(todayKey)?.routes ?? 0;
    const avgOrdersPerDay = daysWithRoutes > 0 ? totalStops / daysWithRoutes : 0;
    const avgStopsPerRoute =
        activeRoutes.length > 0 ? totalStops / activeRoutes.length : 0;

    // Un pedido pendiente está "sin ruta" si no tiene ninguna parada en una ruta activa
    const unassignedOrders = (ordersRes.data ?? []).filter(
        (order) =>
            !(order.stops ?? []).some((stop) => stop.route?.state !== "Cancelada"),
    ).length;

    const routesPerDay: { label: string; value: number }[] = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
        const day = new Date(today);
        day.setDate(day.getDate() - i);
        routesPerDay.push({
            label: `${day.getDate()}/${day.getMonth() + 1}`,
            value: byDay.get(dayKey(day))?.routes ?? 0,
        });
    }

    return {
        routesToday,
        unassignedOrders,
        avgOrdersPerDay,
        avgStopsPerRoute,
        routesPerDay,
    };
});

export type RoutesMetricsData = NonNullable<
    Awaited<ReturnType<typeof getRoutesMetrics>>
>;

// --- Conductor: ruta del día ---

export type RouteClient = {
  id: string;
  name: string;
  phone: string | null;
  street: string;
  number: string;
  city: string;
  province: string;
  observations: string | null;
};

export type RouteProduct = {
  id: string;
  name: string;
};

export type RouteOrderDetail = {
  id: string;
  quantity: number;
  product: RouteProduct | null;
};

export type RouteOrder = {
  id: string;
  state: string | null;
  client: RouteClient | null;
  order_details: RouteOrderDetail[];
};

export type RouteStop = {
  id: string;
  orderId: string;
  visitOrder: number;
  state: string | null;
  order: RouteOrder | null;
};

export type RouteVehicle = {
  id: string;
  patent: string;
};

export type Route = {
  id: string;
  routeNumber: number;
  driverId: string;
  vehicleId: string;
  routeDate: string;
  state: string | null;
  vehicle: RouteVehicle | null;
  stops: RouteStop[];
};

export const getRoutes = cache(async () => {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Calcular inicio de hoy e inicio de mañana para el filtro
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data: routes, error: fetchRoutesError } = await supabase
    .from("routes")
    .select(`
      id,
      routeNumber:route_number,
      driverId:driver_id,
      vehicleId:vehicle_id,
      routeDate:route_date,
      state,
      vehicle:vehicles ( id, patent ),
      stops (
        id,
        orderId:order_id,
        visitOrder:visit_order,
        state,
        order:orders (
          id,
          state,
          client:clients (
            id,
            name,
            phone,
            street,
            number,
            city,
            province,
            observations
          ),
          order_details (
            id,
            quantity,
            product:products ( id, name )
          )
        )
      )
    `)
    .eq("driver_id", user.id)
    .eq("state", "Pendiente")
    .gte("route_date", todayStart)    // Mayor o igual al inicio de hoy
    .lt("route_date", tomorrowStart)  // Estrictamente menor al inicio de mañana
    .order("route_date", {ascending: true});

  if (fetchRoutesError) {
    console.error("Error al obtener las rutas:", fetchRoutesError);
    return null;
  }

  return routes as Route[] | [];
});

export const getRoute = cache(async (routeId: string) => {
  const supabase = await getServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;
  if (!routeId) return null;

  const { data: route, error: fetchRouteError } = await supabase
    .from("routes")
    .select(`
      id,
      routeNumber:route_number,
      driverId:driver_id,
      vehicleId:vehicle_id,
      routeDate:route_date,
      state,
      vehicle:vehicles ( id, patent ),
      stops (
        id,
        orderId:order_id,
        visitOrder:visit_order,
        state,
        order:orders (
          id,
          state,
          client:clients (
            id,
            name,
            phone,
            street,
            number,
            city,
            province,
            observations
          ),
          order_details (
            id,
            quantity,
            product:products ( id, name )
          )
        )
      )
    `)
    .eq("driver_id", user.id)
    .eq("id", routeId)
    .order("visit_order", { foreignTable: "stops", ascending: true })
    .single();

  if (fetchRouteError) {
    console.error("Error al obtener la ruta actual:", fetchRouteError);
    return null;
  }

  return route as unknown as Route | null;
});

export const getPreviousRoutes = cache(async () => {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data: routes, error: fetchRoutesError } = await supabase
    .from("routes")
    .select(`
      id,
      routeNumber:route_number,
      driverId:driver_id,
      vehicleId:vehicle_id,
      routeDate:route_date,
      state,
      vehicle:vehicles ( id, patent ),
      stops (
        id,
        orderId:order_id,
        visitOrder:visit_order,
        state,
        order:orders (
          id,
          state,
          client:clients (
            id,
            name,
            phone,
            street,
            number,
            city,
            province,
            observations
          ),
          order_details (
            id,
            quantity,
            product:products ( id, name )
          )
        )
      )
    `)
    .eq("driver_id", user.id)
    .or(
      `route_date.lt.${todayStart},and(route_date.gte.${todayStart},route_date.lt.${tomorrowStart},state.eq.Finalizada)`
    )
    .order("route_date", { ascending: false });

  if (fetchRoutesError) {
    console.error("Error al obtener las rutas:", fetchRoutesError);
    return null;
  }

  return routes as Route[] | [];
});