"use client";

// Styles
import styles from "./transports.module.css";

// Types
import type { Vehicle } from "@/modules/transports/transports.dal";

type DeleteVehicleDialogProps = {
    vehicle: Vehicle;
    error: string;
    isPending: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

export default function DeleteVehicleDialog({ vehicle, error, isPending, onClose, onConfirm }: DeleteVehicleDialogProps) {
    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-vehicle-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="delete-vehicle-title">Eliminar vehículo</h3>
                    <p>
                        ¿Seguro que querés eliminar el vehículo <strong>{vehicle.patent}</strong>? Vas a poder
                        restaurarlo más adelante desde el filtro de inactivos.
                    </p>
                </div>

                {error && <p className={styles.modalError}>{error}</p>}

                <div className={styles.modalActions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="button" className={styles.dangerButton} onClick={onConfirm} disabled={isPending}>
                        {isPending ? "Eliminando..." : "Eliminar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
