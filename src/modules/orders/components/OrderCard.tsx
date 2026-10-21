"use client";

// Styles
import styles from "./orders.module.css";

// Utils
import {
    getOrderLiveRoute,
    getOrderPermissions,
} from "@/modules/orders/orders.utils";

// Constants and types
import { STATE_STYLES } from "@/modules/orders/orders.constants";
import type { Order } from "@/modules/orders/orders.dal";

// Icons
import { ChevronDown } from "lucide-react";

type OrderCardProps = {
    order: Order;
    today: Date;
    isExpanded: boolean;
    isHighlighted?: boolean;
    isSelected: boolean;
    isUpdating: boolean;
    onToggleExpand: () => void;
    onToggleSelect: () => void;
    onToggleState: () => void;
    onReschedule: () => void;
};

export default function OrderCard({
    order,
    today,
    isExpanded,
    isHighlighted = false,
    isSelected,
    isUpdating,
    onToggleExpand,
    onToggleSelect,
    onToggleState,
    onReschedule,
}: OrderCardProps) {
    const itemsCount =
        order.order_details?.reduce(
            (sum, detail) => sum + (detail.quantity ?? 0),
            0,
        ) ?? 0;
    const { canToggleState, canReschedule } = getOrderPermissions(order, today);
    const liveRoute = getOrderLiveRoute(order);

    return (
        <div
            id={`pedido-${order.id}`}
            className={`${styles.orderCard} ${isHighlighted ? styles.orderCardHighlighted : ""}`}
        >
            <div
                className={styles.orderRow}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest(`[data-selection-checkbox="true"]`)) return;
                    onToggleExpand();
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        const target = e.target as HTMLElement;
                        if (target.closest(`[data-selection-checkbox="true"]`)) return;
                        e.preventDefault();
                        onToggleExpand();
                    }
                }}
            >
                <label
                    className={styles.rowCheckbox}
                    data-selection-checkbox="true"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onToggleSelect();
                        }}
                    />
                    <span />
                </label>
                <span className={styles.orderClient}>{order.client?.name}</span>
                <span className={styles.orderAddress}>
                    {order.client?.street} {order.client?.number}, {order.client?.city}
                </span>
                <span className={styles.orderItems}>
                    {itemsCount} {itemsCount === 1 ? "unidad" : "unidades"}
                </span>
                <span
                    className={`${styles.stateBadge} ${STATE_STYLES[order.state ?? ""] ?? ""}`}
                >
                    {order.state}
                </span>
                <ChevronDown
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}
                    size={18}
                />
            </div>

            {isExpanded && (
                <div className={styles.orderDetailContainer}>
                    <div className={styles.orderDetail}>
                        <div className={styles.detailSection}>
                            <h4>Cliente</h4>
                            <p>{order.client?.name}</p>
                            <p>{order.client?.email}</p>
                            <p>{order.client?.phone}</p>
                            <p>
                                {order.client?.street} {order.client?.number},{" "}
                                {order.client?.city}, {order.client?.province}
                            </p>
                        </div>

                        <div className={styles.detailSection}>
                            <h4>Productos</h4>
                            <ul className={styles.itemsList}>
                                {order.order_details?.map((detail) => (
                                    <li key={detail.id}>
                                        <span>{detail.product?.name}</span>
                                        <span>x{detail.quantity}</span>
                                    </li>
                                ))}
                                {(order.order_details?.length ?? 0) === 0 && (
                                    <li>Sin productos cargados</li>
                                )}
                            </ul>
                        </div>

                        <div className={styles.detailSection}>
                            <h4>Ruta</h4>
                            {liveRoute ? (
                                <p>
                                    Ruta #{liveRoute.route_number} · Vuelta{" "}
                                    {liveRoute.trip_number} ({liveRoute.state})
                                </p>
                            ) : (
                                <p>Sin ruta asignada</p>
                            )}
                        </div>
                    </div>

                    {(canToggleState || canReschedule) && (
                        <div className={styles.detailActions}>
                            {canReschedule && (
                                <button
                                    type="button"
                                    className={`${styles.toggleStateButton} ${styles.rescheduleButton} ${isUpdating ? styles.toggleButtonDisabled : ""}`}
                                    onClick={onReschedule}
                                    disabled={isUpdating}
                                >
                                    Reprogramar
                                </button>
                            )}
                            {canToggleState && (
                                <button
                                    name="ToggleButton"
                                    className={`
                                        ${styles.toggleStateButton}
                                        ${order.state === "Cancelada" ? styles.restoreButton : styles.cancelButton}
                                        ${isUpdating ? styles.toggleButtonDisabled : ""}`}
                                    onClick={onToggleState}
                                    disabled={isUpdating}
                                >
                                    {isUpdating
                                        ? "Procesando..."
                                        : order.state === "Cancelada"
                                            ? "Restaurar"
                                            : "Cancelar pedido"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
