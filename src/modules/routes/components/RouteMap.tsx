"use client";

import "leaflet/dist/leaflet.css";

// Styles
import styles from "./routes.module.css";

// Hooks
import { useEffect, useState } from "react";

// Actions
import { getRoutePath } from "@/modules/routes/routes.actions";

// Map
import { divIcon, latLngBounds } from "leaflet";
import {
    MapContainer,
    Marker,
    Polyline,
    Popup,
    TileLayer,
} from "react-leaflet";

// Constants and types
import {
    MAP_TILE_ATTRIBUTION,
    MAP_TILE_URL,
} from "@/modules/routes/routes.constants";
import { DEPOT } from "@/modules/routes/routes.depot";
import type { MapStop } from "@/modules/routes/routes.types";

type RouteMapProps = {
    routeId: string;
    stops: MapStop[];
    // Alto en px (por defecto el del panel de admin); en el celular se usa uno más bajo
    height?: number;
    // En el celular, para que arrastrar con un dedo haga scroll en la página y no mueva el mapa
    disableDragging?: boolean;
};

type LatLng = [number, number];

// Trazados ya pedidos en esta sesión, para no gastar llamadas a la API al
// abrir y cerrar la misma ruta. La clave incluye las paradas por si cambian.
const roadPathCache = new Map<string, LatLng[] | null>();

function getCacheKey(routeId: string, stops: MapStop[]) {
    return `${routeId}:${stops.map((stop) => `${stop.id}@${stop.latitude},${stop.longitude}`).join("|")}`;
}

// Los marcadores son divs con el número de parada (no dependen de imágenes del paquete)
function createMarkerIcon(label: string, isDepot = false) {
    return divIcon({
        className: styles.markerWrapper,
        html: `<span class="${styles.marker} ${isDepot ? styles.markerDepot : ""}">${label}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
    });
}

export default function RouteMap({ routeId, stops, height, disableDragging = false }: RouteMapProps) {
    const depot: LatLng = [DEPOT.latitude, DEPOT.longitude];
    const stopPositions = stops.map(
        (stop) => [stop.latitude, stop.longitude] as LatLng,
    );
    // Salida desde el depósito, paradas en orden y regreso al depósito (línea recta)
    const path = [depot, ...stopPositions, depot];

    // Trazado real por calles de OpenRouteService; mientras carga (o si falla) se usa la recta
    const cacheKey = getCacheKey(routeId, stops);
    const [roadPath, setRoadPath] = useState<{
        key: string;
        path: LatLng[] | null;
    } | null>(() =>
        roadPathCache.has(cacheKey)
            ? { key: cacheKey, path: roadPathCache.get(cacheKey) ?? null }
            : null,
    );

    useEffect(() => {
        if (stops.length === 0 || roadPathCache.has(cacheKey)) return;

        let active = true;

        getRoutePath(routeId).then((response) => {
            const fetched = "path" in response ? response.path : null;
            roadPathCache.set(cacheKey, fetched);
            if (active) setRoadPath({ key: cacheKey, path: fetched });
        });

        return () => {
            active = false;
        };
    }, [routeId, cacheKey, stops.length]);

    const currentRoadPath =
        roadPath?.key === cacheKey
            ? roadPath.path
            : (roadPathCache.get(cacheKey) ?? null);

    const viewProps =
        stops.length > 0
            ? {
                    bounds: latLngBounds(path),
                    boundsOptions: { padding: [32, 32] as [number, number] },
                }
            : { center: depot, zoom: 13 };

    return (
        <MapContainer
            className={styles.map}
            style={height ? { height } : undefined}
            scrollWheelZoom={false}
            dragging={!disableDragging}
            {...viewProps}
        >
            <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />

            {currentRoadPath ? (
                <Polyline
                    positions={currentRoadPath}
                    pathOptions={{ color: "#3454d1", weight: 4, opacity: 0.8 }}
                />
            ) : (
                <Polyline
                    positions={path}
                    pathOptions={{
                        color: "#3454d1",
                        weight: 3,
                        opacity: 0.7,
                        dashArray: "6 8",
                    }}
                />
            )}

            <Marker position={depot} icon={createMarkerIcon("D", true)}>
                <Popup>
                    <strong>{DEPOT.name}</strong>
                    <br />
                    {DEPOT.address}
                </Popup>
            </Marker>

            {stops.map((stop) => (
                <Marker
                    key={stop.id}
                    position={[stop.latitude, stop.longitude]}
                    icon={createMarkerIcon(String(stop.number))}
                >
                    <Popup>
                        <strong>
                            {stop.number}. {stop.clientName}
                        </strong>
                        <br />
                        {stop.address}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
