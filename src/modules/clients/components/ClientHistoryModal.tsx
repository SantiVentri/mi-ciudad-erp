"use client";

// Hooks
import { useEffect, useState } from "react";

// Styles
import styles from "./clients.module.css";

// Data and constants
import { getClientOrderHistory } from "@/modules/clients/clients.actions";
import { ORDER_STATE_STYLES } from "@/modules/clients/clients.constants";

// Types
import type { Client, ClientOrders } from "@/modules/clients/clients.dal";

type ClientHistoryModalProps = {
    client: Client;
    onClose: () => void;
};

export default function ClientHistoryModal({ client, onClose }: ClientHistoryModalProps) {
    const [orders, setOrders] = useState<ClientOrders | null>(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de datos con cancelación, patrón documentado por React (react.dev/learn/synchronizing-with-effects#fetching-data)
        setIsLoading(true);
        setError("");

        getClientOrderHistory(client.id).then((result) => {
            if (cancelled) return;

            if (result.error) {
                setError(result.error);
            } else {
                setOrders(result.orders ?? []);
            }

            setIsLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [client.id]);

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="client-history-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="client-history-title">Historial de {client.name}</h3>
                    <p>{orders ? `${orders.length} pedido${orders.length === 1 ? "" : "s"}` : ""}</p>
                </div>

                <div className={styles.historyList}>
                    {isLoading && <p className={styles.emptyState}>Cargando historial...</p>}

                    {!isLoading && error && <p className={styles.modalError}>{error}</p>}

                    {!isLoading && !error && orders?.length === 0 && (
                        <p className={styles.emptyState}>Este cliente todavía no tiene pedidos.</p>
                    )}

                    {!isLoading &&
                        !error &&
                        orders?.map((order) => (
                            <div key={order.id} className={styles.historyItem}>
                                <div className={styles.historyItemHeader}>
                                    <span>{order.arrival_date}</span>
                                    <span
                                        className={`${styles.stateBadge} ${ORDER_STATE_STYLES[order.state ?? ""] ?? ""}`}
                                    >
                                        {order.state}
                                    </span>
                                </div>
                                <ul className={styles.itemsList}>
                                    {order.order_details?.map((detail) => (
                                        <li key={detail.id}>
                                            <span>{detail.product?.name}</span>
                                            <span>x{detail.quantity}</span>
                                        </li>
                                    ))}
                                    {(order.order_details?.length ?? 0) === 0 && <li>Sin productos cargados</li>}
                                </ul>
                            </div>
                        ))}
                </div>

                <div className={styles.modalActions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}