"use client";

// Styles
import styles from "./orders.module.css";

// Hooks
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Data and actions
import { updateOrderArrivalDate, setOrderState } from "@/modules/orders/orders.actions";
import type { Order } from "@/modules/orders/orders.dal";

// Constants and utils
import { DAYS_BEFORE, DAYS_AFTER } from "@/modules/orders/orders.constants";
import { dayKey, parseDateOnly, startOfDay, toDateInputValue } from "@/modules/orders/orders.utils";
import type { SortOption } from "@/modules/orders/orders.types";

// Components
import DayTabs from "./DayTabs";
import OrdersToolbar from "./OrdersToolbar";
import OrderCard from "./OrderCard";
import EditDateModal from "./EditDateModal";

type OrdersViewProps = {
    orders: Order[];
};

export default function OrdersView({ orders }: OrdersViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const today = useMemo(() => startOfDay(new Date()), []);

    // --- Navegación por día ---
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

    const dayOrders = useMemo(() => {
        return ordersByDay.get(dayKey(startOfDay(selectedDay))) ?? [];
    }, [ordersByDay, selectedDay]);

    // --- Filtros y orden ---
    const [search, setSearch] = useState("");
    const [stateFilter, setStateFilter] = useState<string>("Todos");
    const [sortBy, setSortBy] = useState<SortOption>("hora-asc");

    // Limpieza de selecciones y expansión al cambiar de día o filtros
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

    const handleSelectDay = (day: Date) => {
        setSelectedDay(day);
        setExpandedId(null);
        setSelectedOrderIds([]);
    };

    // Limpia selecciones huérfanas si cambian los filtros
    useEffect(() => {
        setSelectedOrderIds([]);
        setExpandedId(null);
    }, [search, stateFilter]);

    const filteredOrders = useMemo(() => {
        const term = search.trim().toLowerCase();

        const filtered = dayOrders.filter((order) => {
            if (stateFilter !== "Todos" && order.state !== stateFilter) return false;
            if (!term) return true;

            const client = order.client;
            const haystack = [client?.name, client?.email, client?.phone, client?.street, client?.city]
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

    // --- Selección múltiple + edición de fecha en lote ---
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [nextArrivalDate, setNextArrivalDate] = useState("");
    const [modalError, setModalError] = useState("");

    const selectedOrders = useMemo(
        () => filteredOrders.filter((order) => selectedOrderIds.includes(order.id)),
        [filteredOrders, selectedOrderIds],
    );

    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrderIds((current) =>
            current.includes(orderId)
                ? current.filter((selectedId) => selectedId !== orderId)
                : [...current, orderId],
        );
    };

    const clearSelection = () => setSelectedOrderIds([]);

    const openBulkModal = () => {
        if (selectedOrders.length === 0) {
            setModalError("Seleccioná al menos un pedido.");
            return;
        }
        setEditingOrder(selectedOrders[0]);
        setNextArrivalDate(toDateInputValue(selectedOrders[0].arrival_date));
        setModalError("");
    };

    const closeModal = () => {
        setEditingOrder(null);
        setNextArrivalDate("");
        setModalError("");
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

    // --- Expandir pedido / cambiar estado ---
    const [updatingIds, setUpdatingIds] = useState<string[]>([]);

    const isUpdating = (order: Order) => updatingIds.includes(order.id);

    const handleToggleOrderState = (order: Order) => {
        const newState = order.state === "Pendiente" ? "Cancelada" : "Pendiente";

        setUpdatingIds((prev) => [...prev, order.id]);

        startTransition(async () => {
            await setOrderState(order.id, newState);
            setUpdatingIds((prev) => prev.filter((id) => id !== order.id));
            router.refresh();
        });
    };

    // --- Refresh general ---
    const handleRefresh = () => {
        startTransition(() => {
            router.refresh();
        });
    };

    return (
        <div className={styles.container}>
            <DayTabs
                days={days}
                selectedDay={selectedDay}
                today={today}
                ordersByDay={ordersByDay}
                onSelectDay={handleSelectDay}
            />

            <OrdersToolbar
                search={search}
                onSearchChange={setSearch}
                stateFilter={stateFilter}
                onStateFilterChange={setStateFilter}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                isPending={isPending}
                onRefresh={handleRefresh}
                selectedCount={selectedOrders.length}
                onBulkEdit={openBulkModal}
            />

            <div className={styles.ordersList}>
                {filteredOrders.length === 0 && (
                    <p className={styles.emptyState}>No hay pedidos para este día con esos filtros.</p>
                )}

                {filteredOrders.map((order) => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        today={today}
                        isExpanded={expandedId === order.id}
                        isSelected={selectedOrderIds.includes(order.id)}
                        isUpdating={isUpdating(order)}
                        onToggleExpand={() => setExpandedId(expandedId === order.id ? null : order.id)}
                        onToggleSelect={() => toggleOrderSelection(order.id)}
                        onToggleState={() => handleToggleOrderState(order)}
                    />
                ))}
            </div>

            {editingOrder && (
                <EditDateModal
                    selectedOrders={selectedOrders}
                    nextArrivalDate={nextArrivalDate}
                    onDateChange={setNextArrivalDate}
                    modalError={modalError}
                    isPending={isPending}
                    today={today}
                    onClose={closeModal}
                    onConfirm={handleConfirmDateChange}
                />
            )}
        </div>
    );
}