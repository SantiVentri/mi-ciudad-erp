"use client";

// Styles
import styles from "./transports.module.css";

// Utils and constants
import { getVehicleAssignmentLabel, getVehicleStatus } from "@/modules/transports/transports.utils";
import { VEHICLE_STATUS_STYLES } from "@/modules/transports/transports.constants";

// Types
import type { Driver, Vehicle } from "@/modules/transports/transports.dal";
import type { AssignmentMaps } from "@/modules/transports/transports.utils";

// Icons
import { PencilLine, RotateCcw, Trash2 } from "lucide-react";

type VehiclesTableProps = {
    vehicles: Vehicle[];
    drivers: Driver[];
    assignmentMaps: AssignmentMaps;
    isRestoring: (vehicle: Vehicle) => boolean;
    onEdit: (vehicle: Vehicle) => void;
    onDelete: (vehicle: Vehicle) => void;
    onRestore: (vehicle: Vehicle) => void;
};

export default function VehiclesTable({
    vehicles,
    drivers,
    assignmentMaps,
    isRestoring,
    onEdit,
    onDelete,
    onRestore,
}: VehiclesTableProps) {
    if (vehicles.length === 0) {
        return <p className={styles.emptyState}>No hay vehículos que coincidan con esos filtros.</p>;
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Patente</th>
                        <th>Última asignación</th>
                        <th>Estado</th>
                        <th className={styles.actionsHeader}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {vehicles.map((vehicle) => {
                        const status = getVehicleStatus(vehicle);
                        const isInactive = status === "Inactivo";

                        return (
                            <tr key={vehicle.id}>
                                <td className={styles.primaryCell}>{vehicle.patent}</td>
                                <td className={styles.muted}>
                                    {getVehicleAssignmentLabel(vehicle, assignmentMaps, drivers)}
                                </td>
                                <td>
                                    <span className={`${styles.statusBadge} ${VEHICLE_STATUS_STYLES[status] ?? ""}`}>
                                        {status}
                                    </span>
                                </td>
                                <td>
                                    <div className={styles.rowActions}>
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            onClick={() => onEdit(vehicle)}
                                            title="Editar vehículo"
                                        >
                                            <PencilLine size={16} />
                                        </button>

                                        {isInactive ? (
                                            <button
                                                type="button"
                                                className={styles.iconButton}
                                                onClick={() => onRestore(vehicle)}
                                                disabled={isRestoring(vehicle)}
                                                title="Restaurar vehículo"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className={styles.iconButtonDanger}
                                                onClick={() => onDelete(vehicle)}
                                                title="Eliminar vehículo"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
