import "server-only";
import { getRoadPath, type GeoPoint } from "@/modules/routes/routes.optimizer";
import { DEPOT } from "@/modules/routes/routes.depot";
import { decodePolyline, encodePolyline, routePointsKey } from "@/modules/routes/routes.polyline";
import type { getServerClient } from "@/utils/supabase/getServerClient";

type DbClient = Awaited<ReturnType<typeof getServerClient>>;

type StopWithClient = {
    visit_order: number;
    order: { client: { latitude: number | null; longitude: number | null } | null } | null;
};

/**
 * Puntos del recorrido: depósito → paradas con ubicación, en orden de visita → depósito.
 * Son las mismas paradas que dibuja el mapa como marcadores.
 */
export function routePathPoints(stops: StopWithClient[]): GeoPoint[] {
    const stopPoints = [...stops]
        .sort((a, b) => a.visit_order - b.visit_order)
        .map((stop) => stop.order?.client)
        .filter(
            (client): client is { latitude: number; longitude: number } =>
                client?.latitude != null && client?.longitude != null,
        )
        .map((client) => ({ latitude: Number(client.latitude), longitude: Number(client.longitude) }));

    return stopPoints.length > 0 ? [DEPOT, ...stopPoints, DEPOT] : [];
}

/**
 * Recorrido por calles de una ruta. Primero busca el guardado en route_paths; si no
 * hay o las paradas cambiaron, lo pide a OpenRouteService y lo guarda para la próxima.
 * Devuelve null si no hay guardado y ORS no respondió (el mapa dibuja rectas).
 * Usa el cliente del usuario: RLS y save_route_path limitan al admin y a los
 * conductores de la ruta.
 */
export async function resolveRoutePath(
    supabase: DbClient,
    routeId: string,
    points: GeoPoint[],
): Promise<[number, number][] | null> {
    if (points.length < 2) return null;

    const pointsKey = routePointsKey(points);

    const { data: stored, error: readError } = await supabase
        .from("route_paths")
        .select("points_key, polyline")
        .eq("route_id", routeId)
        .maybeSingle();

    if (readError) {
        console.error("Error leyendo el recorrido guardado de la ruta", routeId, readError);
    } else if (stored && stored.points_key === pointsKey) {
        return decodePolyline(stored.polyline);
    }

    const path = await getRoadPath(points);
    if (!path || path.length < 2) return null;

    const { error: saveError } = await supabase.rpc("save_route_path", {
        p_route_id: routeId,
        p_points_key: pointsKey,
        p_polyline: encodePolyline(path),
    });
    if (saveError) {
        // El mapa se muestra igual; se vuelve a intentar guardar la próxima vez
        console.error("Error guardando el recorrido de la ruta", routeId, saveError);
    }

    return path;
}

/**
 * Guarda el recorrido de una ruta recién creada o editada. Nunca lanza: crear o
 * editar la ruta no tiene que fallar por el mapa.
 */
export async function saveRoutePathSafely(supabase: DbClient, routeId: string) {
    try {
        const { data: route, error } = await supabase
            .from("routes")
            .select("stops ( visit_order, order:orders ( client:clients ( latitude, longitude ) ) )")
            .eq("id", routeId)
            .single();

        if (error || !route) return;
        await resolveRoutePath(supabase, routeId, routePathPoints(route.stops ?? []));
    } catch (error) {
        console.error("Error inesperado guardando el recorrido de la ruta", routeId, error);
    }
}
