"use client";

// Styles
import styles from "./routes.module.css";

// Components
import dynamic from "next/dynamic";

// Utils
import {
    formatRouteClientAddress,
    getRouteCrew,
    getRouteMapData,
    getRouteUnits,
    getSortedStops,
    getStopUnits,
    getVehiclePatent,
    hasCoordinates,
} from "@/modules/routes/routes.utils";

// Constants and types
import {
    ROUTE_STATE_STYLES,
    ADMIN_STOP_STATE_STYLES,
} from "@/modules/routes/routes.constants";
import type { AdminRoute, AdminRouteStop } from "@/modules/routes/routes.dal";

// Icons
import { ChevronDown, MapPinOff, Pencil, Trash2, X } from "lucide-react";

// Leaflet necesita `window`, por eso el mapa se carga solo en el navegador
const RouteMap = dynamic(() => import("./RouteMap"), {
    ssr: false,
    loading: () => <div className={styles.mapPlaceholder}>Cargando mapa...</div>,
});

type RouteCardProps = {
    route: AdminRoute;
    isExpanded: boolean;
    isBusy: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onRemoveStop: (stop: AdminRouteStop) => void;
};

export default function RouteCard({
    route,
    isExpanded,
    isBusy,
    onToggleExpand,
    onEdit,
    onDelete,
    onRemoveStop,
}: RouteCardProps) {
    // Solo se editan las rutas que todavía no salieron
    const isEditable = route.state === "Pendiente";
    const stops = getSortedStops(route);
    const units = getRouteUnits(route);
    const { located, missing } = getRouteMapData(route);

    return (
        <div className={styles.routeCard}>
            <button
                type="button"
                className={styles.routeRow}
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
            >
                <span className={styles.routeNumber}>
                    Ruta #{route.route_number} · V{route.trip_number}
                </span>
                <span className={styles.routeDriver}>{getRouteCrew(route)}</span>
                <span className={styles.routeVehicle}>
                    {getVehiclePatent(route.vehicle)}
                </span>
                <span className={styles.routeStops}>
                    {stops.length} {stops.length === 1 ? "parada" : "paradas"}
                </span>
                <span
                    className={`${styles.stateBadge} ${ROUTE_STATE_STYLES[route.state ?? ""] ?? ""}`}
                >
                    {route.state ?? "Sin estado"}
                </span>
                <ChevronDown
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}
                    size={18}
                />
            </button>

            {isExpanded && (
                <div className={styles.routeDetail}>
                    {isEditable && (
                        <div className={styles.routeActions}>
                            <button
                                type="button"
                                className={styles.actionButton}
                                onClick={onEdit}
                                disabled={isBusy}
                            >
                                <Pencil size={15} />
                                Editar ruta
                            </button>
                            <button
                                type="button"
                                className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                                onClick={onDelete}
                                disabled={isBusy}
                            >
                                <Trash2 size={15} />
                                Borrar ruta
                            </button>
                        </div>
                    )}

                    <div className={styles.stopsColumn}>
                        <h4>
                            Paradas · {units} {units === 1 ? "unidad" : "unidades"}
                        </h4>
                        {stops.length === 0 ? (
                            <p className={styles.emptyState}>
                                Esta ruta todavía no tiene paradas.
                            </p>
                        ) : (
                            <ol className={styles.stopsList}>
                                {stops.map((stop, index) => {
                                    const client = stop.order?.client;
                                    const stopUnits = getStopUnits(stop);

                                    return (
                                        <li key={stop.id} className={styles.stopItem}>
                                            <span className={styles.stopNumber}>{index + 1}</span>
                                            <div className={styles.stopInfo}>
                                                <p className={styles.stopClient}>
                                                    {client?.name ?? "Cliente eliminado"}
                                                </p>
                                                <p className={styles.stopAddress}>
                                                    {formatRouteClientAddress(client)}
                                                </p>
                                                <p className={styles.stopMeta}>
                                                    {stopUnits} {stopUnits === 1 ? "unidad" : "unidades"}
                                                    {client?.phone ? ` · ${client.phone}` : ""}
                                                    {!hasCoordinates(client) && (
                                                        <span className={styles.noLocation}>
                                                            <MapPinOff size={12} /> Sin ubicación
                                                        </span>
                                                    )}
                                                </p>
                                                {client?.observations && (
                                                    <p className={styles.stopNote}>
                                                        {client.observations}
                                                    </p>
                                                )}
                                            </div>
                                            <span
                                                className={`${styles.stateBadge} ${ADMIN_STOP_STATE_STYLES[stop.state ?? ""] ?? ""}`}
                                            >
                                                {stop.state ?? "Sin estado"}
                                            </span>
                                            {isEditable && stop.state !== "Cancelada" && stop.state !== "Entrega fallida" && (
                                                <button
                                                    type="button"
                                                    className={styles.removeStopButton}
                                                    onClick={() => onRemoveStop(stop)}
                                                    disabled={isBusy}
                                                    title="Quitar este pedido de la ruta"
                                                    aria-label={`Quitar a ${client?.name ?? "este pedido"} de la ruta`}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>

                    <div className={styles.mapColumn}>
                        <h4>Previsualización del recorrido</h4>
                        <RouteMap key={route.id} routeId={route.id} stops={located} />
                        {missing > 0 && (
                            <p className={styles.mapWarning}>
                                {missing}{" "}
                                {missing === 1
                                    ? "parada no se muestra"
                                    : "paradas no se muestran"}{" "}
                                en el mapa porque{" "}
                                {missing === 1
                                    ? "el cliente no tiene"
                                    : "los clientes no tienen"}{" "}
                                coordenadas cargadas.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
