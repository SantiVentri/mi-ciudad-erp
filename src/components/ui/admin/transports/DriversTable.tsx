"use client";

// Styles
import styles from "./transports.module.css";

// Utils and constants
import {
    canToggleDriverStatus,
    getDriverAssignmentLabel,
    getDriverName,
    getDriverStatus,
} from "@/modules/transports/transports.utils";
import { DRIVER_STATUS_STYLES } from "@/modules/transports/transports.constants";

// Types
import { Driver } from "@/modules/transports/transports.types";
import type { Vehicle } from "@/modules/transports/transports.dal";
import type { AssignmentMaps } from "@/modules/transports/transports.utils";

// Icons
import { Ban, RotateCcw } from "lucide-react";

type DriversTableProps = {
    drivers: Driver[];
    vehicles: Vehicle[];
    assignmentMaps: AssignmentMaps;
    isToggling: (driver: Driver) => boolean;
    onDeactivate: (driver: Driver) => void;
    onActivate: (driver: Driver) => void;
};

export default function DriversTable({
    drivers,
    vehicles,
    assignmentMaps,
    isToggling,
    onDeactivate,
    onActivate,
}: DriversTableProps) {
    if (drivers.length === 0) {
        return <p className={styles.emptyState}>No hay conductores que coincidan con esos filtros.</p>;
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Contacto</th>
                        <th>Última asignación</th>
                        <th>Estado</th>
                        <th className={styles.actionsHeader}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {drivers.map((driver) => {
                        const status = getDriverStatus(driver);
                        const canToggle = canToggleDriverStatus(driver);
                        const isInactive = status === "Inactivo";

                        return (
                            <tr key={driver.id}>
                                <td className={styles.primaryCell}>{getDriverName(driver)}</td>
                                <td>
                                    <div>{driver.email}</div>
                                    {driver?.phone && <div className={styles.muted}>{driver.phone}</div>}
                                </td>
                                <td className={styles.muted}>
                                    {getDriverAssignmentLabel(driver, assignmentMaps, vehicles)}
                                </td>
                                <td>
                                    <span className={`${styles.statusBadge} ${DRIVER_STATUS_STYLES[status] ?? ""}`}>
                                        {status}
                                    </span>
                                </td>
                                <td>
                                    {canToggle && (
                                        <div className={styles.rowActions}>
                                            {isInactive ? (
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    onClick={() => onActivate(driver)}
                                                    disabled={isToggling(driver)}
                                                    title="Activar conductor"
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={styles.iconButtonDanger}
                                                    onClick={() => onDeactivate(driver)}
                                                    disabled={isToggling(driver)}
                                                    title="Desactivar conductor"
                                                >
                                                    <Ban size={16} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
