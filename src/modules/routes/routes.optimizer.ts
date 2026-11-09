import "server-only";

// Orden de paradas y trazado por calles usando OpenRouteService (plan gratuito).
// - /optimization (VROOM): ordena las paradas saliendo y volviendo al depósito.
// - /v2/directions: devuelve el recorrido real por calles para dibujarlo en el mapa.
// Si la API falla (sin key, límite diario, timeout), se ordena localmente para no
// bloquear al admin.

const ORS_BASE_URL = "https://api.openrouteservice.org";
const ORS_PROFILE = "driving-car";
const ORS_TIMEOUT_MS = 15000;
// Límites del plan gratuito de ORS
const MAX_OPTIMIZATION_JOBS = 50;
const MAX_DIRECTIONS_WAYPOINTS = 50;

export type GeoPoint = {
    latitude: number;
    longitude: number;
};

type OptimizationStep = {
    type: string;
    id?: number;
    job?: number;
};

type OptimizationResponse = {
    routes?: { steps: OptimizationStep[] }[];
    unassigned?: { id: number }[];
};

// /directions/.../geojson trae el trazado y también la distancia y el tiempo:
// una sola consulta sirve para el mapa y para el costo
type DirectionsResponse = {
    features?: {
        geometry: { coordinates: [number, number][] };
        // ORS omite distance/duration cuando valen 0
        properties?: { summary?: { distance?: number; duration?: number } };
    }[];
};

// Por qué no se pudo usar OpenRouteService
export type OrsFailure = "missing_key" | "quota" | "unavailable";

type OrsResult<T> = { data: T } | { failure: OrsFailure };

// Distancia y tiempo de manejo por calles (sin tiempo de descarga en las paradas)
export type RouteMetrics = {
    distanceKm: number;
    durationMin: number;
};

// Contrato del proveedor de ruteo: si se cambia de API, solo se reemplaza la implementación
export type RouteMetricsProvider = (
    points: GeoPoint[],
) => Promise<{ metrics: RouteMetrics } | { failure: OrsFailure }>;

function toLonLat(point: GeoPoint): [number, number] {
    return [point.longitude, point.latitude];
}

async function orsPost<T>(path: string, body: unknown): Promise<OrsResult<T>> {
    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
        console.error("Falta ORS_API_KEY: no se puede usar OpenRouteService");
        return { failure: "missing_key" };
    }

    try {
        const response = await fetch(`${ORS_BASE_URL}${path}`, {
            method: "POST",
            headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
                Accept: "application/json, application/geo+json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(ORS_TIMEOUT_MS),
            cache: "no-store",
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`OpenRouteService ${path} respondió ${response.status}:`, text);
            // 403 "Quota exceeded": cupo diario agotado; 429: demasiadas consultas por minuto
            const quota = response.status === 429 || (response.status === 403 && /quota/i.test(text));
            return { failure: quota ? "quota" : "unavailable" };
        }

        return { data: (await response.json()) as T };
    } catch (error) {
        console.error(`Error llamando a OpenRouteService ${path}:`, error);
        return { failure: "unavailable" };
    }
}

// --- Recorridos por calles (con caché) ---

type Directions = {
    path: [number, number][]; // [lat, lng]
    meters: number;
    seconds: number;
};

// Recorridos ya calculados, por coordenadas: el trazado de una ruta no cambia mientras
// no cambien sus paradas. Así abrir el mapa o recalcular el costo no gasta el cupo
// diario de ORS. Vive en memoria del proceso del servidor.
const MAX_CACHED_DIRECTIONS = 500;
const directionsCache = new Map<string, Directions>();

async function getDirections(points: GeoPoint[]): Promise<{ data: Directions } | { failure: OrsFailure }> {
    const key = points.map((point) => `${point.latitude},${point.longitude}`).join(";");
    const cached = directionsCache.get(key);
    if (cached) return { data: cached };

    const result = await orsPost<DirectionsResponse>(`/v2/directions/${ORS_PROFILE}/geojson`, {
        coordinates: points.map(toLonLat),
        instructions: false,
    });
    if ("failure" in result) return result;

    const feature = result.data.features?.[0];
    if (!feature) return { failure: "unavailable" };

    const directions: Directions = {
        path: feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
        meters: feature.properties?.summary?.distance ?? 0,
        seconds: feature.properties?.summary?.duration ?? 0,
    };

    if (directionsCache.size >= MAX_CACHED_DIRECTIONS) {
        // El más viejo afuera (Map conserva el orden de inserción)
        directionsCache.delete(directionsCache.keys().next().value as string);
    }
    directionsCache.set(key, directions);

    return { data: directions };
}

// --- Orden local (respaldo) ---

function distanceKm(a: GeoPoint, b: GeoPoint) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) *
            Math.cos(toRad(b.latitude)) *
            Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Vecino más cercano desde el depósito + mejora 2-opt sobre el circuito cerrado
 * (depósito → paradas → depósito). Usa distancia en línea recta, así que es una
 * aproximación, pero evita recorridos cruzados.
 */
function orderLocally<T extends GeoPoint>(depot: GeoPoint, stops: T[]): T[] {
    const remaining = [...stops];
    const tour: T[] = [];
    let current: GeoPoint = depot;

    while (remaining.length > 0) {
        let bestIndex = 0;
        for (let i = 1; i < remaining.length; i++) {
            if (
                distanceKm(current, remaining[i]) <
                distanceKm(current, remaining[bestIndex])
            ) {
                bestIndex = i;
            }
        }
        current = remaining.splice(bestIndex, 1)[0];
        tour.push(current as T);
    }

    const pointAt = (i: number): GeoPoint =>
        i < 0 || i >= tour.length ? depot : tour[i];

    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 0; i < tour.length - 1; i++) {
            for (let j = i + 1; j < tour.length; j++) {
                const before =
                    distanceKm(pointAt(i - 1), pointAt(i)) +
                    distanceKm(pointAt(j), pointAt(j + 1));
                const after =
                    distanceKm(pointAt(i - 1), pointAt(j)) +
                    distanceKm(pointAt(i), pointAt(j + 1));

                if (after + 1e-9 < before) {
                    const reversed = tour.slice(i, j + 1).reverse();
                    tour.splice(i, reversed.length, ...reversed);
                    improved = true;
                }
            }
        }
    }

    return tour;
}

// --- API pública del módulo ---

/**
 * Ordena las paradas para que el recorrido depósito → paradas → depósito sea lo más
 * corto posible. `optimized` es false cuando se usó el orden local de respaldo.
 */
export async function optimizeStopOrder<T extends GeoPoint>(
    depot: GeoPoint,
    stops: T[],
): Promise<{ ordered: T[]; optimized: boolean }> {
    if (stops.length <= 1) {
        return { ordered: [...stops], optimized: true };
    }

    if (stops.length > MAX_OPTIMIZATION_JOBS) {
        return { ordered: orderLocally(depot, stops), optimized: false };
    }

    const result = await orsPost<OptimizationResponse>("/optimization", {
        jobs: stops.map((stop, index) => ({
            id: index + 1,
            location: toLonLat(stop),
        })),
        vehicles: [
            {
                id: 1,
                profile: ORS_PROFILE,
                start: toLonLat(depot),
                end: toLonLat(depot),
            },
        ],
    });

    const steps = "data" in result ? result.data.routes?.[0]?.steps : undefined;
    if (!steps) {
        return { ordered: orderLocally(depot, stops), optimized: false };
    }

    const ordered: T[] = [];
    const used = new Set<number>();

    for (const step of steps) {
        if (step.type !== "job") continue;
        const index = (step.id ?? step.job ?? 0) - 1;
        if (stops[index] && !used.has(index)) {
            ordered.push(stops[index]);
            used.add(index);
        }
    }

    // Paradas que ORS no pudo ubicar (ej. sin calle cerca): van al final
    stops.forEach((stop, index) => {
        if (!used.has(index)) ordered.push(stop);
    });

    return { ordered, optimized: used.size === stops.length };
}

// Tramos de hasta MAX_DIRECTIONS_WAYPOINTS puntos que comparten el punto de unión
function chunkWaypoints(points: GeoPoint[]): GeoPoint[][] {
    const chunks: GeoPoint[][] = [];
    for (
        let start = 0;
        start < points.length - 1;
        start += MAX_DIRECTIONS_WAYPOINTS - 1
    ) {
        chunks.push(points.slice(start, start + MAX_DIRECTIONS_WAYPOINTS));
    }
    return chunks;
}

/**
 * Kilómetros y minutos de manejo por calles recorriendo los puntos en el orden dado.
 * Si OpenRouteService no responde devuelve el motivo: nunca se usa la distancia en
 * línea recta, porque subestimaría el costo.
 */
export const getRouteMetrics: RouteMetricsProvider = async (points) => {
    if (points.length < 2) return { metrics: { distanceKm: 0, durationMin: 0 } };

    let meters = 0;
    let seconds = 0;

    for (const chunk of chunkWaypoints(points)) {
        const result = await getDirections(chunk);
        if ("failure" in result) return result;

        meters += result.data.meters;
        seconds += result.data.seconds;
    }

    return {
        metrics: {
            distanceKm: Math.round(meters / 10) / 100,
            durationMin: Math.round(seconds / 60),
        },
    };
};

/**
 * Trazado por calles que une los puntos en el orden dado.
 * Devuelve pares [lat, lng] listos para Leaflet, o null si la API no respondió.
 */
export async function getRoadPath(
    points: GeoPoint[],
): Promise<[number, number][] | null> {
    if (points.length < 2) return null;

    const path: [number, number][] = [];

    for (const chunk of chunkWaypoints(points)) {
        const result = await getDirections(chunk);
        if ("failure" in result) return null;
        path.push(...result.data.path);
    }

    return path;
}
