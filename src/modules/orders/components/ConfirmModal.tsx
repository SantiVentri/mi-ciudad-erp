"use client";

// Styles
import styles from "./orders.module.css";

type ConfirmModalProps = {
    title: string;
    message: string;
    items?: string[];
    // Si no viene, es solo un aviso con un botón "Entendido"
    confirmLabel?: string;
    isPending?: boolean;
    error?: string;
    onClose: () => void;
    onConfirm?: () => void;
};

export default function ConfirmModal({
    title,
    message,
    items,
    confirmLabel,
    isPending = false,
    error,
    onClose,
    onConfirm,
}: ConfirmModalProps) {
    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="confirm-modal-title">{title}</h3>
                    <p>{message}</p>
                </div>

                {items && items.length > 0 && (
                    <ul className={styles.confirmList}>
                        {items.map((item, index) => (
                            <li key={`${index}-${item}`}>{item}</li>
                        ))}
                    </ul>
                )}

                {error && <p className={styles.modalError}>{error}</p>}

                <div className={styles.modalActions}>
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={onClose}
                    >
                        {confirmLabel ? "Volver" : "Entendido"}
                    </button>
                    {confirmLabel && onConfirm && (
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={onConfirm}
                            disabled={isPending}
                        >
                            {isPending ? "Procesando..." : confirmLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
