"use client";

// Styles
import styles from "./orders.module.css";

// Hooks
import { useEffect, useMemo, useState, useTransition } from "react";
import { useResetOnChange } from "@/utils/hooks/useResetOnChange";
import { useRouter } from "next/navigation";

// Data and actions
import {
    updateOrdersArrivalDate,
    cancelOrder,
    restoreOrder,
} from "@/modules/orders/orders.actions";
import type { NewOrderOptions, Order } from "@/modules/orders/orders.dal";

// Constants and utils
import { DAYS_BEFORE, DAYS_AFTER } from "@/modules/orders/orders.constants";
import {
    dayKey,
    getOrderLiveRoute,
    parseDateOnly,
    startOfDay,
    toDateInputValue,
} from "@/modules/orders/orders.utils";
import { todayAR } from "@/utils/dates/argentina";
import type { SortOption } from "@/modules/orders/orders.types";

// Components
import DayTabs from "./DayTabs";
import OrdersToolbar from "./OrdersToolbar";
import OrderCard from "./OrderCard";
import EditDateModal from "./EditDateModal";
import ConfirmModal from "./ConfirmModal";
import CreateOrderModal from "./CreateOrderModal";

type OrdersViewProps = {
    orders: Order[];
    newOrderOptions: NewOrderOptions;
    // Pedido a mostrar al entrar (viene de una parada en Rutas)
    focusOrderId?: string;
};

// Modal de fecha: edición en lote o "Reprogramar" de un solo pedido
type DateModalState = { orders: Order[]; reactivate: boolean };

type Dialog =
    | { kind: "confirmCancel"; order: Order; routeLabel: string }
    | { kind: "confirmDate"; lines: string[] }
    | { kind: "info"; title: string; message: string; items?: string[] };

function describeRoute(order: Order) {
    const route = getOrderLiveRoute(order);
    return route
        ? `Ruta #${route.route_number} (vuelta ${route.trip_number})`
        : "";
}

export default function OrdersView({ orders, newOrderOptions, focusOrderId }: OrdersViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const today = useMemo(() => todayAR(), []);

    // Solo se enfoca si el pedido está dentro de los días que muestra la pantalla
    const focusOrder = orders.find((order) => order.id === focusOrderId);

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

    const [selectedDay, setSelectedDay] = useState<Date>(() =>
        focusOrder ? startOfDay(parseDateOnly(focusOrder.arrival_date)) : today,
    );

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
    const [expandedId, setExpandedId] = useState<string | null>(focusOrder?.id ?? null);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

    // Resaltado del pedido enfocado; se apaga al cambiar de día para que no se repita
    const [highlightedId, setHighlightedId] = useState<string | null>(focusOrder?.id ?? null);

    // Lleva la vista hasta el pedido enfocado (solo al entrar, no en cada refresh)
    const focusedId = focusOrder?.id;
    useEffect(() => {
        if (!focusedId) return;
        document
            .getElementById(`pedido-${focusedId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [focusedId]);

    const handleSelectDay = (day: Date) => {
        setSelectedDay(day);
        setHighlightedId(null);
        setExpandedId(null);
        setSelectedOrderIds([]);
    };

    // Limpia selecciones huérfanas si cambian los filtros
    useResetOnChange([search, stateFilter], () => {
        setSelectedOrderIds([]);
        setExpandedId(null);
    });

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
                    return (
                        parseDateOnly(a.arrival_date).getTime() -
                        parseDateOnly(b.arrival_date).getTime()
                    );
                case "hora-desc":
                    return (
                        parseDateOnly(b.arrival_date).getTime() -
                        parseDateOnly(a.arrival_date).getTime()
                    );
                case "cliente-asc":
                    return (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
                case "cliente-desc":
                    return (b.client?.name ?? "").localeCompare(a.client?.name ?? "");
                default:
                    return 0;
            }
        });
    }, [dayOrders, search, stateFilter, sortBy]);

    // --- Avisos y confirmaciones ---
    const [dialog, setDialog] = useState<Dialog | null>(null);

    // --- Selección múltiple ---
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

    // --- Modal de fecha (edición en lote y Reprogramar) ---
    const [dateModal, setDateModal] = useState<DateModalState | null>(null);
    const [nextArrivalDate, setNextArrivalDate] = useState("");
    const [modalError, setModalError] = useState("");

    // Si el pedido quedó con fecha pasada, se sugiere hoy
    const suggestedDate = (order: Order) =>
        parseDateOnly(order.arrival_date).getTime() < today.getTime()
            ? dayKey(today)
            : toDateInputValue(order.arrival_date);

    const openBulkModal = () => {
        if (selectedOrders.length === 0) {
            setModalError("Seleccioná al menos un pedido.");
            return;
        }
        setDateModal({ orders: selectedOrders, reactivate: false });
        setNextArrivalDate(suggestedDate(selectedOrders[0]));
        setModalError("");
    };

    const openRescheduleModal = (order: Order) => {
        setDateModal({ orders: [order], reactivate: true });
        setNextArrivalDate(suggestedDate(order));
        setModalError("");
    };

    const closeModal = () => {
        setDateModal(null);
        setNextArrivalDate("");
        setModalError("");
        setDialog(null);
    };

    const runDateChange = (release: boolean) => {
        if (!dateModal) return;

        const ids = dateModal.orders.map((order) => order.id);
        const reactivate = dateModal.reactivate;

        startTransition(async () => {
            const response = await updateOrdersArrivalDate(ids, nextArrivalDate, {
                release,
                reactivate,
            });

            setDialog(null);

            if (response?.error) {
                setModalError(response.error);
                return;
            }

            closeModal();
            clearSelection();
            router.refresh();
        });
    };

    const handleConfirmDateChange = () => {
        if (!nextArrivalDate) {
            setModalError("Elegí una nueva fecha.");
            return;
        }
        if (!dateModal || dateModal.orders.length === 0) {
            setModalError("Seleccioná al menos un pedido.");
            return;
        }
        if (parseDateOnly(nextArrivalDate).getTime() < today.getTime()) {
            setModalError("No podés elegir una fecha pasada.");
            return;
        }

        setModalError("");

        // Pedidos que están en una ruta y cambian de día
        const affected = dateModal.orders.filter(
            (order) =>
                getOrderLiveRoute(order) &&
                toDateInputValue(order.arrival_date) !== nextArrivalDate,
        );

        // Si la ruta ya comenzó (o terminó), no se puede mover el pedido
        const started = affected.filter(
            (order) => getOrderLiveRoute(order)?.state !== "Pendiente",
        );
        if (started.length > 0) {
            setDialog({
                kind: "info",
                title: "No se puede cambiar la fecha",
                message: "Estos pedidos están en rutas que ya comenzaron o terminaron:",
                items: started.map(
                    (order) =>
                        `${order.client?.name ?? "Pedido"} · ${describeRoute(order)}`,
                ),
            });
            return;
        }

        // Si la ruta todavía no salió, se pide confirmación para sacarlos de la ruta
        if (affected.length > 0) {
            setDialog({
                kind: "confirmDate",
                lines: affected.map(
                    (order) =>
                        `${order.client?.name ?? "Pedido"} · ${describeRoute(order)}`,
                ),
            });
            return;
        }

        runDateChange(false);
    };

    // --- Cancelar / restaurar pedido ---
    const [updatingIds, setUpdatingIds] = useState<string[]>([]);

    const isUpdating = (order: Order) => updatingIds.includes(order.id);

    const runCancel = (order: Order, release: boolean) => {
        setUpdatingIds((prev) => [...prev, order.id]);

        startTransition(async () => {
            const response = await cancelOrder(order.id, release);
            setUpdatingIds((prev) => prev.filter((id) => id !== order.id));

            setDialog(
                response?.error
                    ? {
                            kind: "info",
                            title: "No se pudo cancelar el pedido",
                            message: response.error,
                        }
                    : null,
            );
            router.refresh();
        });
    };

    const runRestore = (order: Order) => {
        setUpdatingIds((prev) => [...prev, order.id]);

        startTransition(async () => {
            const response = await restoreOrder(order.id);
            setUpdatingIds((prev) => prev.filter((id) => id !== order.id));

            if (response?.error) {
                setDialog({
                    kind: "info",
                    title: "No se pudo restaurar el pedido",
                    message: response.error,
                });
            }
            router.refresh();
        });
    };

    const handleToggleOrderState = (order: Order) => {
        if (order.state === "Cancelada") {
            runRestore(order);
            return;
        }

        const route = getOrderLiveRoute(order);

        if (!route) {
            runCancel(order, false);
            return;
        }

        if (route.state !== "Pendiente") {
            setDialog({
                kind: "info",
                title: "No se puede cancelar el pedido",
                message: `El pedido está en la Ruta #${route.route_number}, que ya está ${(route.state ?? "").toLowerCase()}.`,
            });
            return;
        }

        setDialog({
            kind: "confirmCancel",
            order,
            routeLabel: describeRoute(order),
        });
    };

    // --- Nuevo pedido ---
    const [isCreating, setIsCreating] = useState(false);

    // Al crear, se muestra el día del pedido si entra en los días de la pantalla
    const handleOrderCreated = (arrivalDate: string) => {
        setIsCreating(false);
        const createdDay = days.find((day) => dayKey(day) === arrivalDate);
        if (createdDay) handleSelectDay(createdDay);
        router.refresh();
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
                onNewOrder={() => setIsCreating(true)}
            />

            <div className={styles.ordersList}>
                {filteredOrders.length === 0 && (
                    <p className={styles.emptyState}>
                        No hay pedidos para este día con esos filtros.
                    </p>
                )}

                {filteredOrders.map((order) => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        today={today}
                        isExpanded={expandedId === order.id}
                        isHighlighted={highlightedId === order.id}
                        isSelected={selectedOrderIds.includes(order.id)}
                        isUpdating={isUpdating(order)}
                        onToggleExpand={() =>
                            setExpandedId(expandedId === order.id ? null : order.id)
                        }
                        onToggleSelect={() => toggleOrderSelection(order.id)}
                        onToggleState={() => handleToggleOrderState(order)}
                        onReschedule={() => openRescheduleModal(order)}
                    />
                ))}
            </div>

            {dateModal && (
                <EditDateModal
                    selectedOrders={dateModal.orders}
                    nextArrivalDate={nextArrivalDate}
                    onDateChange={setNextArrivalDate}
                    modalError={modalError}
                    isPending={isPending}
                    today={today}
                    reactivate={dateModal.reactivate}
                    onClose={closeModal}
                    onConfirm={handleConfirmDateChange}
                />
            )}

            {isCreating && (
                <CreateOrderModal
                    options={newOrderOptions}
                    today={today}
                    initialDate={
                        selectedDay.getTime() < today.getTime() ? dayKey(today) : dayKey(selectedDay)
                    }
                    onClose={() => setIsCreating(false)}
                    onCreated={handleOrderCreated}
                />
            )}

            {dialog?.kind === "confirmCancel" && (
                <ConfirmModal
                    title="Cancelar pedido"
                    message={`${dialog.order.client?.name ?? "El pedido"} está en la ${dialog.routeLabel}. Si lo cancelás, se saca de esa ruta.`}
                    confirmLabel="Cancelar pedido"
                    isPending={isPending}
                    onClose={() => setDialog(null)}
                    onConfirm={() => {
                        const order = dialog.order;
                        setDialog(null);
                        runCancel(order, true);
                    }}
                />
            )}

            {dialog?.kind === "confirmDate" && (
                <ConfirmModal
                    title="Sacar pedidos de su ruta"
                    message="Al cambiar la fecha, estos pedidos se sacan de su ruta:"
                    items={dialog.lines}
                    confirmLabel="Cambiar fecha"
                    isPending={isPending}
                    onClose={() => setDialog(null)}
                    onConfirm={() => runDateChange(true)}
                />
            )}

            {dialog?.kind === "info" && (
                <ConfirmModal
                    title={dialog.title}
                    message={dialog.message}
                    items={dialog.items}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}
