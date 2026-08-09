"use client";

import { useState, useTransition } from "react";

// Styles
import styles from "./routeDetails.module.css";

// Hooks
import { useRouter } from "next/navigation";

// Components
import StopCard from "@/components/ui/driver/home/stopCard/StopCard";

// Actions and utils
import { setCompletedRoute, setStopState } from "@/modules/routes/routes.actions";
import {
    sortStopsByVisitOrder,
    formatRouteDate,
    getRouteProgress,
    getPendingStopAddresses,
    buildGoogleMapsRouteUrl,
} from "@/modules/routes/routes.utils";

// Icons
import { Navigation, CheckCircle2 } from "lucide-react";

// Constants
import { DIRECCION_EMBOTELLADORA } from "@/modules/routes/routes.constants";

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
    const [isFinishingRoute, setIsFinishingRoute] = useState(false);

    const router = useRouter();

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

    if (currentRoute.state === "Finalizada") {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <h2>Ruta finalizada</h2>
                    <p>Ya finalizaste tu ruta de hoy. ¡Buen trabajo!</p>
                </div>
            </div>
        );
    }

    const { completed, total, percentage } = getRouteProgress(stops);
    const isRouteCompleted = total > 0 && completed === total;

    const mapsUrl = buildGoogleMapsRouteUrl(getPendingStopAddresses(stops), {
        origin: DIRECCION_EMBOTELLADORA,
        destination: DIRECCION_EMBOTELLADORA,
    });

    const handleToggleStop = (stop: RouteStop) => {
        const wantsCompleted = stop.state !== "Completada";
        const previousStops = stops;

        setErrorMessage(null);
        setPendingStopId(stop.id);

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
                setStops(previousStops);
                setErrorMessage(result.error);
            }

            setPendingStopId(null);
        });
    };

    const handleFinishRoute = async () => {
        setIsFinishingRoute(true);
        setErrorMessage(null);

        if (!isRouteCompleted) {
            setErrorMessage("No se puede finalizar la ruta. Todavía hay paradas pendientes.");
            return;
        }

        await setCompletedRoute(currentRoute.id);

        router.refresh();

        setIsFinishingRoute(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
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

            {mapsUrl && (
                <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mapsButton}
                >
                    <Navigation size={16} />
                    Abrir ruta en Google Maps
                </a>
            )}

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

            {isRouteCompleted && (
                <div className={styles.completionContainer}>
                    <div className={styles.completionHeader}>
                        <CheckCircle2 size={40} className={styles.completionIcon} />
                        <h3>¡Todas las paradas fueron completadas!</h3>
                    </div>
                    <p className={styles.completionText}>
                        Ya podés volver a la embotelladora para finalizar la jornada.
                    </p>
                    <button
                        type="button"
                        className={styles.finishRouteButton}
                        disabled={isFinishingRoute}
                        onClick={handleFinishRoute}
                    >
                        {isFinishingRoute ? "Finalizando..." : "Finalizar ruta"}
                    </button>
                </div>
            )}
        </div>
    );
}