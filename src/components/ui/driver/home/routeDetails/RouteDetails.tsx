"use client";

import { useState, useTransition } from "react";

// Styles
import styles from "./routeDetails.module.css";

// Components
import StopCard from "@/components/ui/driver/home/stopCard/StopCard";

// Actions and utils
import { setStopState } from "@/modules/routes/routes.actions";
import {
    sortStopsByVisitOrder,
    formatRouteDate,
    getRouteProgress,
} from "@/modules/routes/routes.utils";

// Types
import type { CurrentRoute, RouteStop } from "@/modules/routes/routes.dal";

interface RouteDetailsProps {
    currentRoute: CurrentRoute | null;
}

export default function RouteDetails({ currentRoute }: RouteDetailsProps) {
    const [stops, setStops] = useState<RouteStop[]>(
        currentRoute ? sortStopsByVisitOrder(currentRoute.stops ?? []) : []
    );
    const [pendingStopId, setPendingStopId] = useState<RouteStop["id"] | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (!currentRoute) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <h2>No hay ruta asignada</h2>
                    <p>Todavía no tenés una ruta asignada para hoy. Volvé a revisar más tarde.</p>
                </div>
            </div>
        );
    }

    const { completed, total, percentage } = getRouteProgress(stops);

    const handleToggleStop = (stop: RouteStop) => {
        const wantsCompleted = stop.state !== "Completada";
        const previousStops = stops;

        setErrorMessage(null);
        setPendingStopId(stop.id);

        // Actualización optimista de la UI
        setStops((current) =>
            current.map((item) =>
                item.id === stop.id
                    ? { ...item, state: wantsCompleted ? "Completada" : "Pendiente" }
                    : item
            )
        );

        startTransition(async () => {
            const result = await setStopState(String(stop.id), wantsCompleted);

            if ("error" in result) {
                // Revertimos si falló la actualización en el servidor
                setStops(previousStops);
                setErrorMessage(result.error);
            }

            setPendingStopId(null);
        });
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Ruta de hoy</h1>
                <p className={styles.date}>{formatRouteDate(currentRoute.routeDate)}</p>
                {currentRoute.vehicle?.patent && (
                    <p className={styles.vehicle}>Vehículo: {currentRoute.vehicle.patent}</p>
                )}
            </div>

            <div className={styles.progress}>
                <div className={styles.progressBarTrack}>
                    <div className={styles.progressBarFill} style={{ width: `${percentage}%` }} />
                </div>
                <span className={styles.progressLabel}>
                    {completed} de {total} paradas completadas
                </span>
            </div>

            {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

            {stops.length === 0 ? (
                <p className={styles.emptyStops}>No hay paradas asignadas para esta ruta.</p>
            ) : (
                <ul className={styles.stopsList}>
                    {stops.map((stop, index) => (
                        <StopCard
                            key={stop.id}
                            stop={stop}
                            index={index + 1}
                            isUpdating={isPending && pendingStopId === stop.id}
                            onToggle={() => handleToggleStop(stop)}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}