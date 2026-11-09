"use client";

// Styles
import styles from "./routes.module.css";

// Hooks
import { useEffect, useMemo, useState } from "react";

// Actions
import { getAssignmentData } from "@/modules/routes/routes.actions";

// Utils and constants
import {
    LOAD_WINDOW_DAYS,
    rankPeople,
    rankVehicles,
    type AssignmentData,
} from "@/modules/routes/routes.recommendations";
import { parseDateOnly } from "@/modules/orders/orders.utils";

// Components
import CrewPicker from "./CrewPicker";

// Types
import type { SelectOption } from "@/modules/routes/routes.types";

type CrewAssignmentFieldsProps = {
    idPrefix: string;
    date: string;
    // Ruta que se está editando: no cuenta en las recomendaciones
    excludeRouteId?: string;
    drivers: SelectOption[];
    coDrivers: SelectOption[];
    vehicles: SelectOption[];
    driverId: string;
    coDriverId: string;
    vehicleId: string;
    onDriverChange: (id: string) => void;
    onCoDriverChange: (id: string) => void;
    onVehicleChange: (id: string) => void;
};

type Loaded = { key: string; data: AssignmentData | null };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function CrewAssignmentFields({
    idPrefix,
    date,
    excludeRouteId,
    drivers,
    coDrivers,
    vehicles,
    driverId,
    coDriverId,
    vehicleId,
    onDriverChange,
    onCoDriverChange,
    onVehicleChange,
}: CrewAssignmentFieldsProps) {
    const isValidDate = DATE_PATTERN.test(date);
    const requestKey = `${date}|${excludeRouteId ?? ""}`;
    const [loaded, setLoaded] = useState<Loaded | null>(null);

    // Se vuelve a pedir si cambia la fecha (en el modal de editar se puede cambiar)
    useEffect(() => {
        if (!isValidDate) return;
        let active = true;

        getAssignmentData(date, excludeRouteId).then((response) => {
            if (!active) return;
            setLoaded({ key: requestKey, data: "error" in response ? null : response.data });
        });

        return () => {
            active = false;
        };
    }, [date, excludeRouteId, isValidDate, requestKey]);

    // Mientras carga (o si falló) se usan las listas sin recomendaciones
    const isCurrent = loaded?.key === requestKey;
    const data = isCurrent ? loaded.data : null;
    const status = !isValidDate ? "idle" : !isCurrent ? "loading" : data ? "ready" : "error";

    const driverLabel = drivers.find((driver) => driver.id === driverId)?.label ?? "";

    const driverOptions = useMemo(
        () => rankPeople(drivers, data, "driver", coDriverId),
        [drivers, data, coDriverId],
    );
    const coDriverOptions = useMemo(
        () => rankPeople(coDrivers, data, "coDriver", driverId),
        [coDrivers, data, driverId],
    );
    const vehicleOptions = useMemo(
        () => rankVehicles(vehicles, data, driverId, driverLabel),
        [vehicles, data, driverId, driverLabel],
    );

    const dayLabel = isValidDate
        ? (() => {
              const day = parseDateOnly(date);
              return `${day.getDate()}/${day.getMonth() + 1}`;
          })()
        : "";

    return (
        <>
            <CrewPicker
                id={`${idPrefix}Driver`}
                label="Conductor"
                placeholder="Elegí un conductor"
                options={driverOptions}
                value={driverId}
                onChange={onDriverChange}
            />

            <CrewPicker
                id={`${idPrefix}CoDriver`}
                label="Acompañante"
                placeholder="Elegí un acompañante"
                options={coDriverOptions}
                value={coDriverId}
                onChange={onCoDriverChange}
            />

            <CrewPicker
                id={`${idPrefix}Vehicle`}
                label="Vehículo"
                placeholder="Elegí un vehículo"
                options={vehicleOptions}
                value={vehicleId}
                onChange={onVehicleChange}
            />

            {status === "loading" && (
                <p className={styles.pickerCaption}>Calculando recomendaciones...</p>
            )}
            {status === "ready" && (
                <p className={styles.pickerCaption}>
                    Las sugerencias comparan las rutas de {LOAD_WINDOW_DAYS} días antes y{" "}
                    {LOAD_WINDOW_DAYS} después del {dayLabel} (sin las canceladas).
                </p>
            )}
            {status === "error" && (
                <p className={styles.pickerCaption}>
                    No se pudieron cargar las recomendaciones. Podés elegir igual.
                </p>
            )}
        </>
    );
}
