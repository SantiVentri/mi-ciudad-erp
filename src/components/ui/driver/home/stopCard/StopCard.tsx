"use client";

import { useState } from "react";

// Styles
import styles from "./stopCard.module.css";

// Utils and constants
import { formatClientAddress } from "@/modules/routes/routes.utils";
import { STOP_STATE_STYLES } from "@/modules/routes/routes.constants";

// Types
import type { RouteStop } from "@/modules/routes/routes.dal";

// Icons
import { ChevronDown, Check, Phone, Undo2, MapPin } from "lucide-react";

interface StopCardProps {
    stop: RouteStop;
    index: number;
    isUpdating: boolean;
    onToggle: () => void;
}

export default function StopCard({ stop, index, isUpdating, onToggle }: StopCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const client = stop.order?.client;
    const orderDetails = stop.order?.order_details ?? [];
    const isCompleted = stop.state === "Completada";
    const itemsCount = orderDetails.reduce((total, detail) => total + detail.quantity, 0);

    return (
        <li className={`${styles.stopCard} ${isCompleted ? styles.stopCardCompleted : ""}`}>
            <div
                className={styles.stopRow}
                role="button"
                tabIndex={0}
                onClick={() => setIsExpanded((prev) => !prev)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIsExpanded((prev) => !prev);
                    }
                }}
            >
                <span className={styles.stopIndex}>{index}</span>

                <div className={styles.stopMain}>
                    <span className={styles.stopClient}>{client?.name ?? "Cliente sin nombre"}</span>
                    <span className={styles.stopItemsCount}>
                        {itemsCount} {itemsCount === 1 ? "producto" : "productos"}
                    </span>
                </div>

                <span className={`${styles.stateBadge} ${STOP_STATE_STYLES[stop.state ?? ""] ?? ""}`}>
                    {stop.state}
                </span>

                <ChevronDown
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}
                    size={18}
                />
            </div>

            {isExpanded && (
                <div className={styles.stopDetail}>
                    <div className={styles.stopAddress}>
                        <MapPin className={styles.icon} size={16} />
                        <span>{formatClientAddress(client)}</span>
                    </div>
                    {client?.phone && (
                        <a className={styles.phoneLink} href={`tel:${client.phone}`}>
                            <Phone size={16} />
                            {client.phone}
                        </a>
                    )}

                    <div className={styles.detailSection}>
                        <h4>Productos</h4>
                        <ul className={styles.itemsList}>
                            {orderDetails.map((detail) => (
                                <li key={detail.id}>
                                    <span>{detail.product?.name}</span>
                                    <span>x{detail.quantity}</span>
                                </li>
                            ))}
                            {itemsCount === 0 && <li>Sin productos cargados</li>}
                        </ul>
                    </div>

                    {client?.observations && (
                        <div className={styles.detailSection}>
                            <h4>Observaciones</h4>
                            <p>{client.observations}</p>
                        </div>
                    )}

                    <button
                        type="button"
                        className={`${styles.toggleButton} ${isCompleted ? styles.undoButton : styles.completeButton
                            }`}
                        disabled={isUpdating}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                    >
                        {isUpdating ? (
                            "Actualizando..."
                        ) : isCompleted ? (
                            <>
                                <Undo2 size={16} /> Desmarcar
                            </>
                        ) : (
                            <>
                                <Check size={16} /> Marcar como completada
                            </>
                        )}
                    </button>
                </div>
            )}
        </li>
    );
}