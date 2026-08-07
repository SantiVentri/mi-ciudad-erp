"use client";

// Styles
import styles from "./orders.module.css";

// Hooks
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Icons
import { ChevronDown, PencilLine, RefreshCw, Search } from "lucide-react";

// Actions
import { updateOrderArrivalDate } from "@/modules/orders/orders.actions";

// Types
import type { Order } from "@/modules/orders/orders.dal";

type OrdersViewProps = {
    orders: Order[];
};

type SortOption = "hora-asc" | "hora-desc" | "cliente-asc" | "cliente-desc";

const DAYS_BEFORE = 7;
const DAYS_AFTER = 8;

const STATE_OPTIONS = ["Todos", "Pendiente", "Completada", "Cancelada"];

const STATE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
};

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function dayKey(date: Date) {
    // Clave estable en horario local (evita el corrimiento de dia de toISOString con UTC)
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// arrival_date viene de Postgres como "YYYY-MM-DD" (columna `date`, sin hora).
// `new Date("YYYY-MM-DD")` lo interpreta como medianoche UTC, lo que en timezones
// negativos (ej. Argentina, UTC-3) lo corre un dia para atras al pasarlo a hora local.
// Por eso parseamos los componentes a mano y construimos la fecha en hora LOCAL.
function parseDateOnly(dateValue: string) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function toDateInputValue(dateValue: string) {
    const date = parseDateOnly(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export default function OrdersView({ orders }: OrdersViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const today = useMemo(() => startOfDay(new Date()), []);

    const days = useMemo(() => {
        const result: Date[] = [];
        for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            result.push(d);
        }
        return result;
    }, [today]);

    const [selectedDay, setSelectedDay] = useState<Date>(today);
    const [search, setSearch] = useState("");
    const [stateFilter, setStateFilter] = useState<string>("Todos");
    const [sortBy, setSortBy] = useState<SortOption>("hora-asc");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [nextArrivalDate, setNextArrivalDate] = useState("");
    const [modalError, setModalError] = useState("");
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

    const ordersByDay = useMemo(() => {
        const map = new Map<string, Order[]>();

        for (const order of orders) {
            const key = dayKey(startOfDay(parseDateOnly(order.arrival_date)));
            const list = map.get(key) ?? [];
            list.push(order);
            map.set(key, list);
        }

        return map;
    }, [orders]);

    const dayOrders = ordersByDay.get(dayKey(selectedDay)) ?? [];

    const closeModal = () => {
        setEditingOrder(null);
        setNextArrivalDate("");
        setModalError("");
    };

    const openBulkModal = () => {
        if (selectedOrders.length === 0) {
            setModalError("Seleccioná al menos un pedido.");
            return;
        }

        setEditingOrder(selectedOrders[0]);
        setNextArrivalDate(toDateInputValue(selectedOrders[0].arrival_date));
        setModalError("");
    };

    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrderIds((current) =>
            current.includes(orderId)
                ? current.filter((selectedId) => selectedId !== orderId)
                : [...current, orderId],
        );
    };

    const clearSelection = () => {
        setSelectedOrderIds([]);
    };

    const handleConfirmDateChange = () => {
        if (!nextArrivalDate) {
            setModalError("Elegí una nueva fecha.");
            return;
        }

        if (selectedOrders.length === 0) {
            setModalError("Seleccioná al menos un pedido.");
            return;
        }

        if (parseDateOnly(nextArrivalDate).getTime() < today.getTime()) {
            setModalError("No podés elegir una fecha pasada.");
            return;
        }

        setModalError("");

        startTransition(async () => {
            // arrival_date es una columna `date` (sin hora/timezone): mandamos el
            // string "YYYY-MM-DD" del input tal cual, sin pasarlo por Date/UTC.
            const responses = await Promise.all(
                selectedOrders.map((order) => updateOrderArrivalDate(order.id, nextArrivalDate)),
            );

            const firstError = responses.find((response) => response?.error)?.error;

            if (firstError) {
                setModalError(firstError);
                return;
            }

            closeModal();
            clearSelection();
            router.refresh();
        });
    };

    const filteredOrders = useMemo(() => {
        const term = search.trim().toLowerCase();

        const filtered = dayOrders.filter((order) => {
            if (stateFilter !== "Todos" && order.state !== stateFilter) return false;

            if (!term) return true;

            const client = order.client;
            const haystack = [
                client?.name,
                client?.email,
                client?.phone,
                client?.street,
                client?.city,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(term);
        });

        return [...filtered].sort((a, b) => {
            switch (sortBy) {
                case "hora-asc":
                    return parseDateOnly(a.arrival_date).getTime() - parseDateOnly(b.arrival_date).getTime();
                case "hora-desc":
                    return parseDateOnly(b.arrival_date).getTime() - parseDateOnly(a.arrival_date).getTime();
                case "cliente-asc":
                    return (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
                case "cliente-desc":
                    return (b.client?.name ?? "").localeCompare(a.client?.name ?? "");
                default:
                    return 0;
            }
        });
    }, [dayOrders, search, stateFilter, sortBy]);

    const selectedOrders = useMemo(
        () => filteredOrders.filter((order) => selectedOrderIds.includes(order.id)),
        [filteredOrders, selectedOrderIds],
    );

    const handleRefresh = () => {
        startTransition(() => {
            router.refresh();
        });
    }

    return (
        <div className={styles.container}>
            <div className={styles.dayTabs}>
                {days.map((day) => {
                    const key = dayKey(day);
                    const count = ordersByDay.get(key)?.length ?? 0;
                    const isSelected = isSameDay(day, selectedDay);
                    const isToday = isSameDay(day, today);

                    return (
                        <button
                            key={key}
                            type="button"
                            className={[
                                styles.dayTab,
                                isSelected ? styles.dayTabActive : "",
                                isToday ? styles.dayTabToday : "",
                            ].join(" ")}
                            onClick={() => {
                                setSelectedDay(day);
                                setExpandedId(null);
                                setSelectedOrderIds([]);
                            }}
                        >
                            <span className={styles.dayTabWeekday}>{WEEKDAY_LABELS[day.getDay()]}</span>
                            <span className={styles.dayTabDate}>
                                {day.getDate()}/{day.getMonth() + 1}
                            </span>
                            {count > 0 && <span className={styles.dayTabCount}>{count}</span>}
                        </button>
                    );
                })}
            </div>

            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, email, teléfono o dirección..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className={styles.select}
                >
                    {STATE_OPTIONS.map((state) => (
                        <option key={state} value={state}>
                            {state}
                        </option>
                    ))}
                </select>

                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className={styles.select}
                >
                    <option value="cliente-asc">Cliente (A-Z)</option>
                    <option value="cliente-desc">Cliente (Z-A)</option>
                </select>

                <button
                    type="button"
                    className={styles.refreshButton}
                    onClick={handleRefresh}
                    disabled={isPending}
                >
                    <RefreshCw size={16} />
                    {isPending ? "Refrezcando..." : "Refrescar"}
                </button>

                <button
                    type="button"
                    className={styles.bulkEditButton}
                    onClick={openBulkModal}
                    disabled={selectedOrders.length === 0}
                >
                    <PencilLine size={16} />
                    Editar fechas ({selectedOrders.length})
                </button>
            </div>

            <div className={styles.ordersList}>
                {filteredOrders.length === 0 && (
                    <p className={styles.emptyState}>No hay pedidos para este día con esos filtros.</p>
                )}

                {filteredOrders.map((order) => {
                    const isExpanded = expandedId === order.id;
                    const itemsCount = order.order_details?.length ?? 0;
                    const isSelected = selectedOrderIds.includes(order.id);

                    return (
                        <div key={order.id} className={styles.orderCard}>
                            <div
                                className={styles.orderRow}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    const target = e.target as HTMLElement;

                                    if (target.closest(`[data-selection-checkbox="true"]`)) {
                                        return;
                                    }

                                    setExpandedId(isExpanded ? null : order.id);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        const target = e.target as HTMLElement;

                                        if (target.closest(`[data-selection-checkbox="true"]`)) {
                                            return;
                                        }

                                        e.preventDefault();
                                        setExpandedId(isExpanded ? null : order.id);
                                    }
                                }}
                            >
                                <label className={styles.rowCheckbox} data-selection-checkbox="true">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleOrderSelection(order.id)}
                                    />
                                    <span />
                                </label>
                                <span className={styles.orderClient}>{order.client?.name}</span>
                                <span className={styles.orderAddress}>
                                    {order.client?.street} {order.client?.number}, {order.client?.city}
                                </span>
                                <span className={styles.orderItems}>
                                    {itemsCount} {itemsCount === 1 ? "producto" : "productos"}
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
                                <div className={styles.orderDetail}>
                                    <div className={styles.detailSection}>
                                        <h4>Cliente</h4>
                                        <p>{order.client?.name}</p>
                                        <p>{order.client?.email}</p>
                                        <p>{order.client?.phone}</p>
                                        <p>
                                            {order.client?.street} {order.client?.number}, {order.client?.city},{" "}
                                            {order.client?.province}
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
                                            {itemsCount === 0 && <li>Sin productos cargados</li>}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {editingOrder && (
                <div
                    className={styles.modalOverlay}
                    onClick={closeModal}
                    role="presentation"
                >
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
                                onChange={(e) => setNextArrivalDate(e.target.value)}
                            />
                        </label>

                        {modalError && <p className={styles.modalError}>{modalError}</p>}

                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryButton} onClick={closeModal}>
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={handleConfirmDateChange}
                                disabled={isPending}
                            >
                                {isPending ? "Guardando..." : "Confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}