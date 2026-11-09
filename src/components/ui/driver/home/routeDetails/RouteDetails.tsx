"use client";

import { useState, useTransition } from "react";

// Styles
import styles from "./routeDetails.module.css";
import costStyles from "@/modules/costs/components/costs.module.css";

// Hooks
import { useRouter } from "next/navigation";

// Components
import dynamic from "next/dynamic";
import StopCard from "@/components/ui/driver/home/stopCard/StopCard";
import RouteExpenseForm from "@/modules/costs/components/RouteExpenseForm";
import RouteExpensesList from "@/modules/costs/components/RouteExpensesList";

// Leaflet necesita `window`, por eso el mapa se carga solo en el navegador
const RouteMap = dynamic(() => import("@/modules/routes/components/RouteMap"), {
    ssr: false,
    loading: () => <div className={styles.mapPlaceholder}>Cargando mapa...</div>,
});

// Actions and utils
import { setCompletedRoute, setStopState, startRoute } from "@/modules/routes/routes.actions";
import {
    sortStopsByVisitOrder,
    formatRouteDate,
    getRouteProgress,
    buildDriverMapsLink,
    getDriverMapStops,
    isPastRoute,
} from "@/modules/routes/routes.utils";

// Icons
import { Navigation, CheckCircle2 } from "lucide-react";

// Types
import type { Route, RouteStop } from "@/modules/routes/routes.dal";
import type { StopState } from "@/modules/routes/routes.actions";
import type { RouteExpense } from "@/modules/costs/costs.types";

interface RouteDetailsProps {
    route: Route | null;
    // Solo tipo, monto y nota: el conductor no recibe sueldos ni costos estimados
    expenses?: RouteExpense[];
}

export default function RouteDetails({ route, expenses = [] }: RouteDetailsProps) {
    const [stops, setStops] = useState<RouteStop[]>(
        route ? sortStopsByVisitOrder(route.stops ?? []) : []
    );
    const [pendingStopId, setPendingStopId] = useState<RouteStop["id"] | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isFinishingRoute, setIsFinishingRoute] = useState(false);
    const [isStartingRoute, setIsStartingRoute] = useState(false);

    const router = useRouter();

    if (!route) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <h2>No hay rutas asignadas</h2>
                    <p>Todavía no tenés rutas asignadas para hoy. Volvé a revisar más tarde.</p>
                </div>
            </div>
        );
    }

    const readOnly = isPastRoute(route.routeDate);

    if (!readOnly && route.state === "Completada") {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <h2>Ruta finalizada</h2>
                    <p>Ya finalizaste todas las paradas de esta ruta. ¡Buen trabajo!</p>
                </div>
            </div>
        );
    }

    const { total, completed, failed, percentage } = getRouteProgress(stops);
    const isRouteCompleted = total > 0 && (completed + failed) === total;

    const mapsLink = buildDriverMapsLink(stops);
    const { located, missing } = getDriverMapStops(stops);

    const handleToggleStop = (stop: RouteStop, newState: StopState) => {
        const previousStops = stops;

        setErrorMessage(null);
        setPendingStopId(stop.id);

        setStops((current) =>
            current.map((item) =>
                item.id === stop.id ? { ...item, state: newState } : item
            )
        );

        startTransition(async () => {
            const result = await setStopState(stop.id, newState);

            if (!result.ok) {
                setStops(previousStops);
                setErrorMessage(result.error);
            } else if (route.state === "Pendiente") {
                // La primera parada marcada pasa la ruta a "En curso": se refresca para
                // mostrar la carga de gastos
                router.refresh();
            }

            setPendingStopId(null);
        });
    };

    const handleStartRoute = async () => {
        setIsStartingRoute(true);
        setErrorMessage(null);

        const result = await startRoute(route.id);

        if (!result.ok) {
            setErrorMessage(result.error);
        } else {
            router.refresh();
        }

        setIsStartingRoute(false);
    };

    const canStartRoute = !readOnly && route.state === "Pendiente";
    const canAddExpenses = !readOnly && route.state === "En curso";

    const handleFinishRoute = async () => {
        setIsFinishingRoute(true);
        setErrorMessage(null);

        if (!isRouteCompleted) {
            setErrorMessage("No se puede finalizar la ruta. Todavía hay paradas pendientes.");
            setIsFinishingRoute(false);
            return;
        }

        const result = await setCompletedRoute(route.id);

        if (!result.ok) {
            setErrorMessage(result.error);
            setIsFinishingRoute(false);
            return;
        }

        router.refresh();

        setIsFinishingRoute(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Ruta N°{route.routeNumber}</h1>
                <p className={styles.date}>{formatRouteDate(route.routeDate)}</p>
                {route.vehicle?.patent && (
                    <p className={styles.vehicle}>Vehículo: <strong>{route.vehicle.patent}</strong></p>
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

            {stops.length > 0 && (
                <div className={styles.mapSection}>
                    <RouteMap routeId={route.id} stops={located} height={260} disableDragging />
                    {missing > 0 && (
                        <p className={styles.mapWarning}>
                            {missing === 1
                                ? "1 parada no aparece en el mapa porque el cliente no tiene ubicación cargada."
                                : `${missing} paradas no aparecen en el mapa porque los clientes no tienen ubicación cargada.`}
                        </p>
                    )}
                </div>
            )}

            {canStartRoute && (
                <div className={styles.completionContainer}>
                    <p className={styles.completionText}>
                        Tocá <strong>Iniciar ruta</strong> cuando salgas de la embotelladora, así se
                        registra la hora de salida.
                    </p>
                    <button
                        type="button"
                        className={styles.finishRouteButton}
                        disabled={isStartingRoute}
                        onClick={handleStartRoute}
                    >
                        {isStartingRoute ? "Iniciando..." : "Iniciar ruta"}
                    </button>
                </div>
            )}

            {!readOnly && (
                <div className={styles.mapsActions}>
                    <a
                        href={mapsLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.mapsButton}
                    >
                        <Navigation size={16} />
                        {mapsLink.stopsCount === 0
                            ? "Volver a la embotelladora"
                            : mapsLink.returnsToDepot
                                ? "Abrir ruta en Google Maps"
                                : `Abrir próximas ${mapsLink.stopsCount} paradas en Google Maps`}
                    </a>
                    {mapsLink.remaining > 0 && (
                        <p className={styles.mapsHint}>
                            Google Maps admite pocas paradas por recorrido. Cuando las marques
                            (entregadas o fallidas), volvé a tocar el botón para seguir con las{" "}
                            {mapsLink.remaining} restantes.
                        </p>
                    )}
                </div>
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
                            onToggle={(newState) => handleToggleStop(stop, newState)}
                            readOnly={readOnly}
                        />
                    ))}
                </ul>
            )}

            {(canAddExpenses || expenses.length > 0) && (
                <section className={costStyles.expenseSection} aria-labelledby="route-expenses-title">
                    <h2 id="route-expenses-title" className={costStyles.expenseSectionTitle}>
                        Gastos de la ruta
                    </h2>
                    {canAddExpenses && <RouteExpenseForm routeId={route.id} />}
                    <RouteExpensesList expenses={expenses} />
                </section>
            )}

            {isRouteCompleted && (
                <div className={styles.completionContainer}>
                    <div className={styles.completionHeader}>
                        <CheckCircle2 size={40} className={styles.completionIcon} />
                        <h3>¡Todas las paradas fueron completadas!</h3>
                    </div>
                    <p className={styles.completionText}>
                        Ya podés volver a la embotelladora.
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