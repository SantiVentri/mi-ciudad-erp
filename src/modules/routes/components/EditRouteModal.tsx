"use client";

// Styles
import styles from "./routes.module.css";

// Hooks
import { useState, useTransition } from "react";

// Actions
import { editRoute } from "@/modules/routes/routes.actions";

// Utils
import { dayKey, toDateInputValue } from "@/modules/orders/orders.utils";

// Types
import type { AdminRoute } from "@/modules/routes/routes.dal";
import type { SelectOption } from "@/modules/routes/routes.types";

type EditRouteModalProps = {
    route: AdminRoute;
    today: Date;
    drivers: SelectOption[];
    vehicles: SelectOption[];
    onClose: () => void;
    // Se llama con la fecha guardada, para poder ir a ese día si cambió
    onSaved: (date: string) => void;
};

export default function EditRouteModal({
    route,
    today,
    drivers,
    vehicles,
    onClose,
    onSaved,
}: EditRouteModalProps) {
    const [date, setDate] = useState(toDateInputValue(route.route_date));
    const [driverId, setDriverId] = useState(route.driver?.id ?? "");
    const [coDriverId, setCoDriverId] = useState(route.co_driver?.id ?? "");
    const [vehicleId, setVehicleId] = useState(route.vehicle?.id ?? "");
    const [modalError, setModalError] = useState("");
    const [isPending, startTransition] = useTransition();

    const dateChanged = date !== toDateInputValue(route.route_date);
    const stopsCount = (route.stops ?? []).filter((stop) => stop.state !== "Cancelada" && stop.state !== "Entrega fallida").length;

    // Si el conductor actual quedó inactivo no está en la lista: se muestra igual para que se vea quién es
    const withCurrent = (options: SelectOption[], id: string, label: string) =>
        id && !options.some((option) => option.id === id)
            ? [{ id, label: `${label} (inactivo)` }, ...options]
            : options;

    const driverOptions = withCurrent(
        drivers,
        route.driver?.id ?? "",
        `${route.driver?.first_name ?? ""} ${route.driver?.last_name ?? ""}`.trim(),
    );
    const coDriverOptions = withCurrent(
        drivers,
        route.co_driver?.id ?? "",
        `${route.co_driver?.first_name ?? ""} ${route.co_driver?.last_name ?? ""}`.trim(),
    );
    const vehicleOptions = withCurrent(vehicles, route.vehicle?.id ?? "", route.vehicle?.patent ?? "");

    const canSave =
        Boolean(date && driverId && coDriverId && vehicleId) &&
        driverId !== coDriverId &&
        !isPending;

    const handleSave = () => {
        setModalError("");

        if (date < dayKey(today)) {
            setModalError("No podés elegir una fecha pasada.");
            return;
        }

        startTransition(async () => {
            const response = await editRoute({
                routeId: route.id,
                date,
                driverId,
                coDriverId,
                vehicleId,
            });

            if ("error" in response) {
                setModalError(response.error);
                return;
            }

            onSaved(date);
        });
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-route-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="edit-route-title">Editar ruta #{route.route_number}</h3>
                    <p>
                        Vuelta {route.trip_number} · {stopsCount}{" "}
                        {stopsCount === 1 ? "parada" : "paradas"}
                    </p>
                </div>

                <label className={styles.modalField} htmlFor="editRouteDate">
                    Fecha
                    <input
                        id="editRouteDate"
                        type="date"
                        min={dayKey(today)}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </label>

                <label className={styles.modalField} htmlFor="editRouteDriver">
                    Conductor
                    <select
                        id="editRouteDriver"
                        value={driverId}
                        onChange={(e) => setDriverId(e.target.value)}
                    >
                        <option value="">Elegí un conductor</option>
                        {driverOptions
                            .filter((driver) => driver.id !== coDriverId)
                            .map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                    {driver.label}
                                </option>
                            ))}
                    </select>
                </label>

                <label className={styles.modalField} htmlFor="editRouteCoDriver">
                    Acompañante
                    <select
                        id="editRouteCoDriver"
                        value={coDriverId}
                        onChange={(e) => setCoDriverId(e.target.value)}
                    >
                        <option value="">Elegí un acompañante</option>
                        {coDriverOptions
                            .filter((driver) => driver.id !== driverId)
                            .map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                    {driver.label}
                                </option>
                            ))}
                    </select>
                </label>

                <label className={styles.modalField} htmlFor="editRouteVehicle">
                    Vehículo
                    <select
                        id="editRouteVehicle"
                        value={vehicleId}
                        onChange={(e) => setVehicleId(e.target.value)}
                    >
                        <option value="">Elegí un vehículo</option>
                        {vehicleOptions.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.label}
                            </option>
                        ))}
                    </select>
                </label>

                {dateChanged && (
                    <p className={styles.modalInfo}>
                        {stopsCount === 1
                            ? "El pedido de la ruta se mueve a la fecha nueva."
                            : `Los ${stopsCount} pedidos de la ruta se mueven a la fecha nueva.`}{" "}
                        Si la vuelta {route.trip_number} está ocupada ese día, se usa la otra.
                    </p>
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
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleSave}
                        disabled={!canSave}
                    >
                        {isPending ? "Guardando..." : "Guardar cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}
