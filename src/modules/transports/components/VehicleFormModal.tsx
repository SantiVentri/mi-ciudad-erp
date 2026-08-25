"use client";

// Hooks
import { useState, type ChangeEvent, type FormEvent } from "react";

// Styles
import styles from "./transports.module.css";

// Utils
import { getVehicleFormValues } from "@/modules/transports/transports.utils";

// Types
import type { Vehicle } from "@/modules/transports/transports.dal";

type VehicleFormModalProps = {
    vehicle: Vehicle | null; // null = creando, Vehicle = editando
    error: string;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (formData: FormData) => void;
};

export default function VehicleFormModal({ vehicle, error, isPending, onClose, onSubmit }: VehicleFormModalProps) {
    const [values, setValues] = useState(() => getVehicleFormValues(vehicle));
    const isEditing = vehicle !== null;

    const handleChange = (field: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) => {
        setValues((current) => ({ ...current, [field]: e.target.value }));
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => formData.set(key, value));

        onSubmit(formData);
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="vehicle-form-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="vehicle-form-title">{isEditing ? "Editar vehículo" : "Nuevo vehículo"}</h3>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.modalField}>
                        Patente
                        <input
                            type="text"
                            value={values.patent}
                            onChange={handleChange("patent")}
                            placeholder="AB123CD"
                            required
                        />
                    </label>

                    {error && <p className={styles.modalError}>{error}</p>}

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.secondaryButton} onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className={styles.primaryButton} disabled={isPending}>
                            {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear vehículo"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
