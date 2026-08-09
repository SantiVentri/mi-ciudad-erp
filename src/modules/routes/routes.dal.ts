import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'

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
      state,
      stops (
        id,
        orderId:order_id,
        visitOrder:visit_order,
        state
      )
    `)
    .eq("driver_id", user.id)
    .gte("route_date", `${todayString} 00:00:00`)
    .lte("route_date", `${todayString} 23:59:59`)
    .maybeSingle();

  if (fetchRouteError) {
    console.error("Error al obtener la ruta actual:", fetchRouteError);
    return null;
  }

  return currentRoute;
});