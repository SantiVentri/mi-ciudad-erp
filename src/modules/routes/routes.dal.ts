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

export type CurrentRoute = {
  id: string;
  driverId: string;
  vehicleId: string;
  routeDate: string;
  state: string | null;
  vehicle: RouteVehicle | null;
  stops: RouteStop[];
};

export const getCurrentRoute = cache(async () => {
  const supabase = await getServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayString = `${year}-${month}-${day}`; // Ej: "2026-08-08"

  const { data: currentRoute, error: fetchRouteError } = await supabase
    .from("routes")
    .select(`
      id,
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
    .gte("route_date", `${todayString} 00:00:00`)
    .lte("route_date", `${todayString} 23:59:59`)
    .order("visit_order", { foreignTable: "stops", ascending: true })
    .maybeSingle();

  if (fetchRouteError) {
    console.error("Error al obtener la ruta actual:", fetchRouteError);
    return null;
  }

  return currentRoute as unknown as CurrentRoute | null;
});