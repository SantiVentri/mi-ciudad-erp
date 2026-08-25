"use client";

// Styles
import styles from "./orders.module.css";

// Utils
import { dayKey } from "@/modules/orders/orders.utils";

// Types
import type { Order } from "@/modules/orders/orders.dal";

type EditDateModalProps = {
    selectedOrders: Order[];
    nextArrivalDate: string;
    onDateChange: (value: string) => void;
    modalError: string;
    isPending: boolean;
    today: Date;
    onClose: () => void;
    onConfirm: () => void;
};

export default function EditDateModal({
    selectedOrders,
    nextArrivalDate,
    onDateChange,
    modalError,
    isPending,
    today,
    onClose,
    onConfirm,
}: EditDateModalProps) {
    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-order-date-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="edit-order-date-title">
                        Editar fecha de {selectedOrders.length} pedido{selectedOrders.length === 1 ? "" : "s"}
                    </h3>
                    <p>
                        {selectedOrders
                            .slice(0, 3)
                            .map((order) => order.client?.name)
                            .filter(Boolean)
                            .join(", ")}
                        {selectedOrders.length > 3 ? "..." : ""}
                    </p>
                </div>

                <label className={styles.modalField} htmlFor="newArrivalDate">
                    Nueva fecha
                    <input
                        id="newArrivalDate"
                        type="date"
                        min={dayKey(today)}
                        value={nextArrivalDate}
                        onChange={(e) => onDateChange(e.target.value)}
                    />
                </label>

                {modalError && <p className={styles.modalError}>{modalError}</p>}

                <div className={styles.modalActions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="button" className={styles.primaryButton} onClick={onConfirm} disabled={isPending}>
                        {isPending ? "Guardando..." : "Confirmar"}
                    </button>
                </div>
            </div>
        </div>
    );
}