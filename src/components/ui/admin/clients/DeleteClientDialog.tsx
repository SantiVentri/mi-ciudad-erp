"use client";

// Styles
import styles from "./clients.module.css";

// Types
import type { Client } from "@/modules/clients/clients.dal";

type DeleteClientDialogProps = {
    client: Client;
    error: string;
    isPending: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

export default function DeleteClientDialog({ client, error, isPending, onClose, onConfirm }: DeleteClientDialogProps) {
    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-client-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="delete-client-title">Eliminar cliente</h3>
                    <p>
                        ¿Seguro que querés eliminar a <strong>{client.name}</strong>? Vas a poder restaurarlo
                        más adelante desde el filtro de inactivos.
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