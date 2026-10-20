"use client";

// Styles
import styles from "./routes.module.css";

// Hooks
import { useEffect, useState, useTransition } from "react";

// Actions
import {
    generateRoute,
    getRouteGenerationPreview,
} from "@/modules/routes/routes.actions";

// Utils and constants
import { pickFreeTrip } from "@/modules/routes/routes.utils";
import { WEEKDAY_LABELS } from "@/modules/routes/routes.constants";
import { parseDateOnly } from "@/modules/orders/orders.utils";

// Types
import type {
    GenerateRouteResult,
    RouteGenerationPreview,
    SelectOption,
} from "@/modules/routes/routes.types";

// Icons
import { MapPinOff } from "lucide-react";

type GenerateRouteModalProps = {
    date: string;
    drivers: SelectOption[];
    vehicles: SelectOption[];
    onClose: () => void;
};

type PreviewState =
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; preview: RouteGenerationPreview };

function formatDayLabel(date: string) {
    const day = parseDateOnly(date);
    return `${WEEKDAY_LABELS[day.getDay()]} ${day.getDate()}/${day.getMonth() + 1}`;
}

export default function GenerateRouteModal({
    date,
    drivers,
    vehicles,
    onClose,
}: GenerateRouteModalProps) {
    const [previewState, setPreviewState] = useState<PreviewState>({
        status: "loading",
    });
    const [driverId, setDriverId] = useState("");
    const [coDriverId, setCoDriverId] = useState("");
    const [vehicleId, setVehicleId] = useState("");
    const [modalError, setModalError] = useState("");
    const [result, setResult] = useState<GenerateRouteResult | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        let active = true;

        getRouteGenerationPreview(date).then((response) => {
            if (!active) return;
            setPreviewState(
                "error" in response
                    ? { status: "error", error: response.error }
                    : { status: "ready", preview: response.preview },
            );
        });

        return () => {
            active = false;
        };
    }, [date]);

    const preview =
        previewState.status === "ready" ? previewState.preview : null;
    const hasSelection = Boolean(driverId && coDriverId && vehicleId);
    const tripNumber =
        preview && hasSelection
            ? pickFreeTrip(preview.busySlots, driverId, coDriverId, vehicleId)
            : null;

    const canGenerate =
        !!preview &&
        preview.ordersCount > 0 &&
        hasSelection &&
        driverId !== coDriverId &&
        tripNumber !== null &&
        !isPending;

    const handleGenerate = () => {
        setModalError("");

        startTransition(async () => {
            const response = await generateRoute({
                date,
                driverId,
                coDriverId,
                vehicleId,
            });

            if ("error" in response) {
                setModalError(response.error);
                return;
            }

            setResult(response.result);
        });
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="generate-route-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="generate-route-title">
                        Generar ruta · {formatDayLabel(date)}
                    </h3>
                    <p>
                        Las paradas se ordenan automáticamente saliendo y volviendo a la
                        embotelladora.
                    </p>
                </div>

                {result ? (
                    <>
                        <div className={styles.modalSummary}>
                            <p>
                                Se creó la{" "}
                                <strong>
                                    {result.routeNumber !== null
                                        ? `ruta #${result.routeNumber}`
                                        : "ruta"}
                                </strong>{" "}
                                (vuelta {result.tripNumber}) con {result.stopsCount}{" "}
                                {result.stopsCount === 1 ? "parada" : "paradas"}.
                            </p>
                            {!result.optimized && (
                                <p className={styles.modalWarning}>
                                    No se pudo optimizar todo el recorrido con OpenRouteService:
                                    el orden es aproximado (distancia en línea recta). Revisalo en
                                    el mapa.
                                </p>
                            )}
                            {result.excludedCount > 0 && (
                                <p className={styles.modalWarning}>
                                    {result.excludedCount}{" "}
                                    {result.excludedCount === 1
                                        ? "pedido quedó afuera"
                                        : "pedidos quedaron afuera"}{" "}
                                    por no tener ubicación.
                                </p>
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={onClose}
                            >
                                Entendido
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {previewState.status === "loading" && (
                            <p className={styles.modalSummary}>Cargando pedidos del día...</p>
                        )}

                        {previewState.status === "error" && (
                            <p className={styles.modalError}>{previewState.error}</p>
                        )}

                        {preview && (
                            <div className={styles.modalSummary}>
                                <p>
                                    <strong>{preview.ordersCount}</strong>{" "}
                                    {preview.ordersCount === 1
                                        ? "pedido pendiente sin ruta"
                                        : "pedidos pendientes sin ruta"}
                                </p>

                                {preview.excluded.length > 0 && (
                                    <div className={styles.modalWarning}>
                                        <p>
                                            <MapPinOff size={14} /> {preview.excluded.length}{" "}
                                            {preview.excluded.length === 1
                                                ? "pedido no entra"
                                                : "pedidos no entran"}{" "}
                                            porque el cliente no tiene ubicación:
                                        </p>
                                        <ul className={styles.excludedList}>
                                            {preview.excluded.map((order) => (
                                                <li key={order.orderId}>
                                                    {order.clientName} · {order.address}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {preview && preview.ordersCount > 0 && (
                            <>
                                <label className={styles.modalField} htmlFor="routeDriver">
                                    Conductor
                                    <select
                                        id="routeDriver"
                                        value={driverId}
                                        onChange={(e) => setDriverId(e.target.value)}
                                    >
                                        <option value="">Elegí un conductor</option>
                                        {drivers
                                            .filter((driver) => driver.id !== coDriverId)
                                            .map((driver) => (
                                                <option key={driver.id} value={driver.id}>
                                                    {driver.label}
                                                </option>
                                            ))}
                                    </select>
                                </label>

                                <label className={styles.modalField} htmlFor="routeCoDriver">
                                    Acompañante
                                    <select
                                        id="routeCoDriver"
                                        value={coDriverId}
                                        onChange={(e) => setCoDriverId(e.target.value)}
                                    >
                                        <option value="">Elegí un acompañante</option>
                                        {drivers
                                            .filter((driver) => driver.id !== driverId)
                                            .map((driver) => (
                                                <option key={driver.id} value={driver.id}>
                                                    {driver.label}
                                                </option>
                                            ))}
                                    </select>
                                </label>

                                <label className={styles.modalField} htmlFor="routeVehicle">
                                    Vehículo
                                    <select
                                        id="routeVehicle"
                                        value={vehicleId}
                                        onChange={(e) => setVehicleId(e.target.value)}
                                    >
                                        <option value="">Elegí un vehículo</option>
                                        {vehicles.map((vehicle) => (
                                            <option key={vehicle.id} value={vehicle.id}>
                                                {vehicle.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {drivers.length < 2 && (
                                    <p className={styles.modalWarning}>
                                        Se necesitan al menos dos conductores activos.
                                    </p>
                                )}

                                {hasSelection &&
                                    (tripNumber !== null ? (
                                        <p className={styles.modalInfo}>
                                            Se asigna a la vuelta {tripNumber}.
                                        </p>
                                    ) : (
                                        <p className={styles.modalWarning}>
                                            Los choferes o el vehículo ya tienen las dos vueltas
                                            ocupadas este día.
                                        </p>
                                    ))}
                            </>
                        )}

                        {modalError && <p className={styles.modalError}>{modalError}</p>}

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={onClose}
                            >
                                Cancelar
                            </button>
                            {preview && preview.ordersCount > 0 && (
                                <button
                                    type="button"
                                    className={styles.primaryButton}
                                    onClick={handleGenerate}
                                    disabled={!canGenerate}
                                >
                                    {isPending ? "Generando..." : "Generar ruta"}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
