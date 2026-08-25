"use client";

// Hooks
import { useState, type ChangeEvent, type FormEvent } from "react";

// Styles
import styles from "./clients.module.css";

// Utils
import { getClientFormValues } from "@/modules/clients/clients.utils";

// Types
import type { Client } from "@/modules/clients/clients.dal";

type ClientFormModalProps = {
    client: Client | null; // null = creando, Client = editando
    error: string;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (formData: FormData) => void;
};

export default function ClientFormModal({ client, error, isPending, onClose, onSubmit }: ClientFormModalProps) {
    const [values, setValues] = useState(() => getClientFormValues(client));
    const isEditing = client !== null;

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
                aria-labelledby="client-form-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="client-form-title">{isEditing ? "Editar cliente" : "Nuevo cliente"}</h3>
                </div>

                <form className={styles.clientForm} onSubmit={handleSubmit}>
                    <label className={styles.modalField}>
                        Nombre
                        <input type="text" value={values.name} onChange={handleChange("name")} required />
                    </label>

                    <label className={styles.modalField}>
                        Email
                        <input type="email" value={values.email} onChange={handleChange("email")} required />
                    </label>

                    <label className={styles.modalField}>
                        Teléfono
                        <input type="text" value={values.phone} onChange={handleChange("phone")} required />
                    </label>

                    <div className={styles.fieldRow}>
                        <label className={styles.modalField}>
                            Calle
                            <input type="text" value={values.street} onChange={handleChange("street")} required />
                        </label>

                        <label className={styles.modalFieldSmall}>
                            Número
                            <input type="text" value={values.number} onChange={handleChange("number")} required />
                        </label>
                    </div>

                    <div className={styles.fieldRow}>
                        <label className={styles.modalField}>
                            Ciudad
                            <input type="text" value={values.city} onChange={handleChange("city")} required />
                        </label>

                        <label className={styles.modalField}>
                            Provincia
                            <input type="text" value={values.province} onChange={handleChange("province")} required />
                        </label>
                    </div>

                    {error && <p className={styles.modalError}>{error}</p>}

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.secondaryButton} onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className={styles.primaryButton} disabled={isPending}>
                            {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear cliente"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}