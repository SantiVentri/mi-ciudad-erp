"use client";

// Styles
import styles from "./orders.module.css";

// Hooks
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useResetOnChange } from "@/utils/hooks/useResetOnChange";
import { useRouter } from "next/navigation";

// Data and actions
import {
    updateOrdersArrivalDate,
    cancelOrder,
    restoreOrder,
} from "@/modules/orders/orders.actions";
import type { NewOrderOptions, Order, OrdersPage } from "@/modules/orders/orders.dal";

// Constants and utils
import {
    ALL_ORDERS_PAGE_SIZE,
    ALL_ORDERS_VIEW,
    DAYS_BEFORE,
    DAYS_AFTER,
} from "@/modules/orders/orders.constants";
import {
    dayKey,
    formatOrderDayHeading,
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
import PaginationControl from "@/components/ui/admin/pagination/PaginationControl";

type OrdersViewProps = {
    orders: Order[];
    newOrderOptions: NewOrderOptions;
    // Pedido a mostrar al entrar (viene de una parada en Rutas)
    focusOrderId?: string;
    // Vista "Todos" (?vista=todos): una página ya filtrada en el servidor; null = vista por día
    allOrders: (OrdersPage & { search: string; state: string }) | null;
};

const ORDERS_PATH = "/admin/orders";
// Espera tras dejar de escribir antes de buscar en el servidor (vista "Todos")
const SEARCH_DEBOUNCE_MS = 350;

// Modal de fecha: edición en lote o "Reprogramar" de un solo pedido
type DateModalState = { orders: Order[]; reactivate: boolean };

type Dialog =
    | { kind: "confirmCancel"; order: Order; routeLabel: string }
    | { kind: "confirmDate"; lines: string[] }
    | { kind: "info"; title: string; message: string; items?: string[] };

function describeRoute(order: Order) {
    const route = getOrderLiveRoute(order);
    return route ? `Ruta #${route.route_number}` : "";
}

export default function OrdersView({
    orders,
    newOrderOptions,
    focusOrderId,
    allOrders,
}: OrdersViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isNavigating, startNavigation] = useTransition();
    const today = useMemo(() => todayAR(), []);
    const containerRef = useRef<HTMLDivElement>(null);
    const isAllView = allOrders !== null;

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
    // En la vista "Todos" arrancan desde la URL (puede llegarse con ?q=...&estado=...)
    const [search, setSearch] = useState(allOrders?.search ?? "");
    const [stateFilter, setStateFilter] = useState<string>(allOrders?.state ?? "Todos");
    const [sortBy, setSortBy] = useState<SortOption>("hora-asc");

    // --- Vista "Todos": página, búsqueda y estado viven en la URL ---
    // Así router.refresh() (después de cancelar, reprogramar, etc.) recarga la misma página
    const navigateToAll = (next: { page?: number; search: string; state: string }, replace = false) => {
        const params = new URLSearchParams({ vista: ALL_ORDERS_VIEW });
        if (next.page && next.page > 1) params.set("pagina", String(next.page));
        if (next.search.trim()) params.set("q", next.search.trim());
        if (next.state !== "Todos") params.set("estado", next.state);

        const url = `${ORDERS_PATH}?${params}`;
        startNavigation(() => {
            if (replace) router.replace(url, { scroll: false });
            else router.push(url, { scroll: false });
        });
    };

    const handleSelectAll = () => {
        if (isAllView) return;
        setHighlightedId(null);
        setExpandedId(null);
        setSelectedOrderIds([]);
        navigateToAll({ search, state: stateFilter });
    };

    const handleStateFilterChange = (value: string) => {
        setStateFilter(value);
        if (isAllView) navigateToAll({ search, state: value });
    };

    const handlePageChange = (page: number) => {
        if (!allOrders) return;
        navigateToAll({ page, search: allOrders.search, state: allOrders.state });
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Si el estado de la URL cambia por atrás/adelante del navegador, el select lo acompaña.
    // (La búsqueda no: se navega con replace, así que el historial no la cambia, y pisarla
    // borraría lo que se está escribiendo mientras carga.)
    useResetOnChange([allOrders?.state], () => {
        if (allOrders) setStateFilter(allOrders.state);
    });

    // La búsqueda va al servidor recién cuando se deja de escribir (replace: no llena el historial)
    const appliedSearch = allOrders?.search;
    useEffect(() => {
        if (appliedSearch === undefined || search.trim() === appliedSearch) return;

        const timeout = setTimeout(
            () => navigateToAll({ search, state: stateFilter }, true),
            SEARCH_DEBOUNCE_MS,
        );
        return () => clearTimeout(timeout);
        // navigateToAll cambia en cada render; solo importa cuando cambia el texto
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, appliedSearch]);

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
        // Desde "Todos" se vuelve a la vista por día (sin parámetros en la URL)
        if (isAllView) {
            startNavigation(() => router.push(ORDERS_PATH, { scroll: false }));
        }
    };

    // Limpia selecciones huérfanas si cambian los filtros, la vista o la página
    useResetOnChange([search, stateFilter, isAllView, allOrders?.page], () => {
        setSelectedOrderIds([]);
        setExpandedId(null);
    });

    const filteredOrders = useMemo(() => {
        // En "Todos" el servidor ya filtró y ordenó (de la fecha más lejana a la más vieja)
        if (allOrders) return allOrders.orders;

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
    }, [allOrders, dayOrders, search, stateFilter, sortBy]);

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
        // En "Todos" el pedido nuevo aparece al refrescar, sin cambiar de vista
        if (isAllView) {
            router.refresh();
            return;
        }
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
        <div className={styles.container} ref={containerRef}>
            <DayTabs
                days={days}
                selectedDay={selectedDay}
                today={today}
                ordersByDay={ordersByDay}
                isAllView={isAllView}
                onSelectDay={handleSelectDay}
                onSelectAll={handleSelectAll}
            />

            <OrdersToolbar
                search={search}
                onSearchChange={setSearch}
                stateFilter={stateFilter}
                onStateFilterChange={handleStateFilterChange}
                showSort={!isAllView}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                isPending={isPending}
                onRefresh={handleRefresh}
                selectedCount={selectedOrders.length}
                onBulkEdit={openBulkModal}
                onNewOrder={() => setIsCreating(true)}
            />


            <div
                className={`${styles.ordersList} ${isNavigating ? styles.ordersListLoading : ""}`}
                aria-busy={isNavigating}
            >
                {filteredOrders.length === 0 && (
                    <p className={styles.emptyState}>
                        {isAllView
                            ? "No hay pedidos con esos filtros."
                            : "No hay pedidos para este día con esos filtros."}
                    </p>
                )}

                {filteredOrders.map((order, index) => {
                    // En "Todos" se mezclan días: un encabezado cada vez que cambia la fecha
                    const orderDay = dayKey(parseDateOnly(order.arrival_date));
                    const showDayHeading =
                        isAllView &&
                        (index === 0 ||
                            dayKey(parseDateOnly(filteredOrders[index - 1].arrival_date)) !== orderDay);

                    return (
                        <Fragment key={order.id}>
                            {showDayHeading && (
                                <h3 className={styles.dayHeading}>
                                    {formatOrderDayHeading(order.arrival_date, today)}
                                </h3>
                            )}
                            <OrderCard
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
                        </Fragment>
                    );
                })}
            </div>

            {allOrders && allOrders.total > 0 && (
                <div className={styles.pagination}>
                    <span className={styles.paginationSummary}>
                        {(allOrders.page - 1) * ALL_ORDERS_PAGE_SIZE + 1}–
                        {(allOrders.page - 1) * ALL_ORDERS_PAGE_SIZE + allOrders.orders.length} de{" "}
                        {allOrders.total} {allOrders.total === 1 ? "pedido" : "pedidos"}
                    </span>
                    {allOrders.totalPages > 1 && (
                        <PaginationControl
                            currentPage={allOrders.page}
                            setCurrentPage={handlePageChange}
                            totalPages={allOrders.totalPages}
                        />
                    )}
                </div>
            )}

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
