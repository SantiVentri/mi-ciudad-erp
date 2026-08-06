"use client";

// Styles
import styles from "./orders.module.css";

// Hooks
import { useMemo, useState } from "react";

// Icons
import { ChevronDown, Search } from "lucide-react";

// Types
import type { Order } from "@/modules/orders/orders.dal";

type OrdersViewProps = {
    orders: Order[];
};

type SortOption = "hora-asc" | "hora-desc" | "cliente-asc" | "cliente-desc";

const DAYS_BEFORE = 7;
const DAYS_AFTER = 8;

const STATE_OPTIONS = ["Todos", "Pendiente", "Completada", "Cancelada", "Reprogramada"];

const STATE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
    Reprogramada: styles.stateReprogramada,
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

export default function OrdersView({ orders }: OrdersViewProps) {
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

    const ordersByDay = useMemo(() => {
        const map = new Map<string, Order[]>();

        for (const order of orders) {
            const key = dayKey(startOfDay(new Date(order.arrival_date)));
            const list = map.get(key) ?? [];
            list.push(order);
            map.set(key, list);
        }

        return map;
    }, [orders]);

    const dayOrders = ordersByDay.get(dayKey(selectedDay)) ?? [];

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
                    return new Date(a.arrival_date).getTime() - new Date(b.arrival_date).getTime();
                case "hora-desc":
                    return new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime();
                case "cliente-asc":
                    return (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
                case "cliente-desc":
                    return (b.client?.name ?? "").localeCompare(a.client?.name ?? "");
                default:
                    return 0;
            }
        });
    }, [dayOrders, search, stateFilter, sortBy]);

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
            </div>

            <div className={styles.ordersList}>
                {filteredOrders.length === 0 && (
                    <p className={styles.emptyState}>No hay pedidos para este día con esos filtros.</p>
                )}

                {filteredOrders.map((order) => {
                    const isExpanded = expandedId === order.id;
                    const itemsCount = order.order_details?.length ?? 0;

                    return (
                        <div key={order.id} className={styles.orderCard}>
                            <button
                                type="button"
                                className={styles.orderRow}
                                onClick={() => setExpandedId(isExpanded ? null : order.id)}
                            >
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
                            </button>

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
        </div>
    );
}