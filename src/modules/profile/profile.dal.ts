import "server-only";
import { cache } from "react";
import { getServerClient } from "@/utils/supabase/getServerClient";

// Perfil del usuario logueado + resumen de sus rutas (como conductor o acompañante)
export const getDriverProfile = cache(async () => {
    const supabase = await getServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const [profileRes, routesRes] = await Promise.all([
        supabase
            .from("profiles")
            .select("first_name, last_name, display_name, phone, avatar, created_at")
            .eq("id", user.id)
            .single(),
        supabase
            .from("routes")
            .select("state, stops ( state )")
            .or(`driver_id.eq.${user.id},co_driver_id.eq.${user.id}`),
    ]);

    if (profileRes.error) {
        console.error("Error trayendo el perfil:", profileRes.error.message);
        return null;
    }

    if (routesRes.error) {
        console.error("Error trayendo las rutas del perfil:", routesRes.error.message);
    }

    const routes = routesRes.data ?? [];
    const stops = routes.flatMap((route) => route.stops ?? []);

    return {
        email: user.email ?? "",
        firstName: profileRes.data.first_name,
        lastName: profileRes.data.last_name,
        displayName: profileRes.data.display_name,
        phone: profileRes.data.phone,
        avatar: profileRes.data.avatar,
        memberSince: profileRes.data.created_at,
        stats: {
            completedRoutes: routes.filter((route) => route.state === "Completada").length,
            deliveredStops: stops.filter((stop) => stop.state === "Completada").length,
            failedStops: stops.filter((stop) => stop.state === "Entrega fallida").length,
        },
    };
});

export type DriverProfile = NonNullable<Awaited<ReturnType<typeof getDriverProfile>>>;
