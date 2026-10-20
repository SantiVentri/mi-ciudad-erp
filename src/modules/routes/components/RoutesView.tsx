"use client";

// Styles
import styles from "./routes.module.css";

// Hooks
import { useMemo, useState, useTransition } from "react";
import { useResetOnChange } from "@/utils/hooks/useResetOnChange";
import { useRouter } from "next/navigation";

// Data and actions
import { deleteRoute, removeOrderFromRoute } from "@/modules/routes/routes.actions";
import type { AdminRoute, RouteStop } from "@/modules/routes/routes.dal";
import type { DayOrdersStatus, SelectOption } from "@/modules/routes/routes.types";

// Constants and utils
import { DAYS_AFTER, DAYS_BEFORE } from "@/modules/routes/routes.constants";
import { matchesRouteSearch } from "@/modules/routes/routes.utils";
import {
    dayKey,
    parseDateOnly,
    startOfDay,
} from "@/modules/orders/orders.utils";
import { todayAR } from "@/utils/dates/argentina";

// Components
import RouteDayTabs from "./RouteDayTabs";
import RoutesToolbar from "./RoutesToolbar";
import RouteCard from "./RouteCard";
import GenerateRouteModal from "./GenerateRouteModal";
import EditRouteModal from "./EditRouteModal";
import ConfirmModal from "@/modules/orders/components/ConfirmModal";

type RoutesViewProps = {
    routes: AdminRoute[];
    ordersByDay: Record<string, DayOrdersStatus>;
    drivers: SelectOption[];
    vehicles: SelectOption[];
};

type Dialog =
    | { kind: "confirmDelete"; route: AdminRoute }
    | { kind: "confirmRemoveStop"; route: AdminRoute; stop: RouteStop }
    | { kind: "info"; title: string; message: string };

function liveStopsCount(route: AdminRoute) {
    return (route.stops ?? []).filter((stop) => stop.state !== "Cancelada").length;
}

export default function RoutesView({
    routes,
    ordersByDay,
    drivers,
    vehicles,
}: RoutesViewProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const today = useMemo(() => todayAR(), []);

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

    const routesByDay = useMemo(() => {
        const map = new Map<string, AdminRoute[]>();
        for (const route of routes) {
            const key = dayKey(startOfDay(parseDateOnly(route.route_date)));
            const list = map.get(key) ?? [];
            list.push(route);
            map.set(key, list);
        }
        return map;
    }, [routes]);

    const dayRoutes = useMemo(() => {
        return routesByDay.get(dayKey(startOfDay(selectedDay))) ?? [];
    }, [routesByDay, selectedDay]);

    // --- Filtros ---
    const [search, setSearch] = useState("");
    const [stateFilter, setStateFilter] = useState<string>("Todos");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleSelectDay = (day: Date) => {
        setSelectedDay(day);
        setExpandedId(null);
    };

    useResetOnChange([search, stateFilter], () => {
        setExpandedId(null);
    });

    const filteredRoutes = useMemo(() => {
        const term = search.trim();

        return dayRoutes
            .filter((route) => {
                if (stateFilter !== "Todos" && route.state !== stateFilter)
                    return false;
                return matchesRouteSearch(route, term);
            })
            .sort((a, b) => a.route_number - b.route_number);
    }, [dayRoutes, search, stateFilter]);

    // --- Generar ruta ---
    const [isGenerateOpen, setIsGenerateOpen] = useState(false);
    const canGenerate = selectedDay.getTime() >= today.getTime();

    // --- Editar / borrar ---
    const [editingRoute, setEditingRoute] = useState<AdminRoute | null>(null);
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const [busyRouteId, setBusyRouteId] = useState<string | null>(null);

    const handleEditSaved = (date: string) => {
        setEditingRoute(null);
        // Si la ruta cambió de día, se va a ese día para seguir viéndola
        if (date !== dayKey(selectedDay)) {
            const newDay = days.find((day) => dayKey(day) === date);
            if (newDay) setSelectedDay(newDay);
        }
    };

    const runDelete = (route: AdminRoute) => {
        setDialog(null);
        setBusyRouteId(route.id);

        startTransition(async () => {
            const response = await deleteRoute(route.id);
            setBusyRouteId(null);

            if (response?.error) {
                setDialog({
                    kind: "info",
                    title: "No se pudo borrar la ruta",
                    message: response.error,
                });
                return;
            }

            setExpandedId(null);
        });
    };

    const runRemoveStop = (route: AdminRoute, stop: RouteStop) => {
        setDialog(null);
        if (!stop.order) return;

        const orderId = stop.order.id;
        setBusyRouteId(route.id);

        startTransition(async () => {
            const response = await removeOrderFromRoute(route.id, orderId);
            setBusyRouteId(null);

            if (response?.error) {
                setDialog({
                    kind: "info",
                    title: "No se pudo quitar el pedido",
                    message: response.error,
                });
            }
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
            <RouteDayTabs
                days={days}
                selectedDay={selectedDay}
                today={today}
                ordersByDay={ordersByDay}
                onSelectDay={handleSelectDay}
            />

            <RoutesToolbar
                search={search}
                onSearchChange={setSearch}
                stateFilter={stateFilter}
                onStateFilterChange={setStateFilter}
                isPending={isPending}
                onRefresh={handleRefresh}
                canGenerate={canGenerate}
                onGenerate={() => setIsGenerateOpen(true)}
            />

            <div className={styles.routesList}>
                {filteredRoutes.length === 0 && (
                    <p className={styles.emptyState}>
                        No hay rutas para este día con esos filtros.
                    </p>
                )}

                {filteredRoutes.map((route) => (
                    <RouteCard
                        key={route.id}
                        route={route}
                        isExpanded={expandedId === route.id}
                        isBusy={busyRouteId === route.id}
                        onToggleExpand={() =>
                            setExpandedId(expandedId === route.id ? null : route.id)
                        }
                        onEdit={() => setEditingRoute(route)}
                        onDelete={() => setDialog({ kind: "confirmDelete", route })}
                        onRemoveStop={(stop) =>
                            setDialog({ kind: "confirmRemoveStop", route, stop })
                        }
                    />
                ))}
            </div>

            {isGenerateOpen && (
                <GenerateRouteModal
                    date={dayKey(selectedDay)}
                    drivers={drivers}
                    vehicles={vehicles}
                    onClose={() => setIsGenerateOpen(false)}
                />
            )}

            {editingRoute && (
                <EditRouteModal
                    route={editingRoute}
                    today={today}
                    drivers={drivers}
                    vehicles={vehicles}
                    onClose={() => setEditingRoute(null)}
                    onSaved={handleEditSaved}
                />
            )}

            {dialog?.kind === "confirmDelete" && (
                <ConfirmModal
                    title={`Borrar ruta #${dialog.route.route_number}`}
                    message={`Se borra la ruta y sus ${liveStopsCount(dialog.route)} pedidos vuelven a quedar pendientes de asignar. A los choferes les llega un aviso.`}
                    confirmLabel="Borrar ruta"
                    isPending={isPending}
                    onClose={() => setDialog(null)}
                    onConfirm={() => runDelete(dialog.route)}
                />
            )}

            {dialog?.kind === "confirmRemoveStop" && (
                <ConfirmModal
                    title="Quitar pedido de la ruta"
                    message={
                        liveStopsCount(dialog.route) === 1
                            ? `${dialog.stop.order?.client?.name ?? "El pedido"} es la última parada: si lo quitás, la ruta #${dialog.route.route_number} se borra.`
                            : `${dialog.stop.order?.client?.name ?? "El pedido"} sale de la ruta #${dialog.route.route_number} y vuelve a quedar pendiente de asignar.`
                    }
                    confirmLabel="Quitar pedido"
                    isPending={isPending}
                    onClose={() => setDialog(null)}
                    onConfirm={() => runRemoveStop(dialog.route, dialog.stop)}
                />
            )}

            {dialog?.kind === "info" && (
                <ConfirmModal
                    title={dialog.title}
                    message={dialog.message}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}
