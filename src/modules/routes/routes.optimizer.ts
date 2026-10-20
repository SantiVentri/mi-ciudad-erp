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

type DirectionsResponse = {
    features?: { geometry: { coordinates: [number, number][] } }[];
};

function toLonLat(point: GeoPoint): [number, number] {
    return [point.longitude, point.latitude];
}

async function orsPost<T>(path: string, body: unknown): Promise<T | null> {
    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
        console.error("Falta ORS_API_KEY: no se puede usar OpenRouteService");
        return null;
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
            console.error(
                `OpenRouteService ${path} respondió ${response.status}:`,
                await response.text(),
            );
            return null;
        }

        return (await response.json()) as T;
    } catch (error) {
        console.error(`Error llamando a OpenRouteService ${path}:`, error);
        return null;
    }
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

    const steps = result?.routes?.[0]?.steps;
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

/**
 * Trazado por calles que une los puntos en el orden dado.
 * Devuelve pares [lat, lng] listos para Leaflet, o null si la API no respondió.
 */
export async function getRoadPath(
    points: GeoPoint[],
): Promise<[number, number][] | null> {
    if (points.length < 2) return null;

    // Tramos de hasta MAX_DIRECTIONS_WAYPOINTS puntos que comparten el punto de unión
    const chunks: GeoPoint[][] = [];
    for (
        let start = 0;
        start < points.length - 1;
        start += MAX_DIRECTIONS_WAYPOINTS - 1
    ) {
        chunks.push(points.slice(start, start + MAX_DIRECTIONS_WAYPOINTS));
    }

    const path: [number, number][] = [];

    for (const chunk of chunks) {
        const result = await orsPost<DirectionsResponse>(
            `/v2/directions/${ORS_PROFILE}/geojson`,
            { coordinates: chunk.map(toLonLat) },
        );

        const coordinates = result?.features?.[0]?.geometry.coordinates;
        if (!coordinates) return null;

        for (const [lon, lat] of coordinates) {
            path.push([lat, lon]);
        }
    }

    return path;
}
