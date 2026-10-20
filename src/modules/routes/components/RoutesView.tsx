"use client";

// Styles
import styles from "./routes.module.css";

// Hooks
import { useMemo, useState, useTransition } from "react";
import { useResetOnChange } from "@/utils/hooks/useResetOnChange";
import { useRouter } from "next/navigation";

// Data
import type { AdminRoute } from "@/modules/routes/routes.dal";
import type { SelectOption } from "@/modules/routes/routes.types";

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

type RoutesViewProps = {
    routes: AdminRoute[];
    drivers: SelectOption[];
    vehicles: SelectOption[];
};

export default function RoutesView({
    routes,
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
                routesByDay={routesByDay}
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
                        onToggleExpand={() =>
                            setExpandedId(expandedId === route.id ? null : route.id)
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
        </div>
    );
}
