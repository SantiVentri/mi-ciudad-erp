import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'

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

  // Calcular solo el inicio de hoy
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

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
    .lt("route_date", todayStart)
    .order("route_date", {ascending: false});

  if (fetchRoutesError) {
    console.error("Error al obtener las rutas:", fetchRoutesError);
    return null;
  }

  return routes as Route[] | [];
});