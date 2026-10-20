// Styles
import styles from "./routesMetrics.module.css";

// Components
import Metric from "@/components/ui/admin/dashboard/metric/Metric";
import GrowthChart from "@/components/ui/admin/dashboard/growthChart/GrowthChart";

// Data
import { getRoutesMetrics } from "@/modules/routes/routes.dal";

// Icons
import { CalendarDays, ListOrdered, Package, Route } from "lucide-react";

export default async function RoutesMetrics() {
    const metrics = await getRoutesMetrics();

    const routesToday = metrics?.routesToday ?? 0;
    const unassignedOrders = metrics?.unassignedOrders ?? 0;
    const avgOrdersPerDay = metrics?.avgOrdersPerDay ?? 0;
    const avgStopsPerRoute = metrics?.avgStopsPerRoute ?? 0;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Route size={15} />}
                    title="Rutas de hoy"
                    value={routesToday}
                    description="Rutas programadas para hoy"
                />
                <Metric
                    icon={<Package size={15} />}
                    title="Pedidos sin ruta"
                    value={unassignedOrders}
                    description="Pendientes de hoy y los próximos 8 días sin asignar"
                />
                <Metric
                    icon={<CalendarDays size={15} />}
                    title="Pedidos por día"
                    value={avgOrdersPerDay.toFixed(1)}
                    description="Promedio de los últimos 30 días con rutas"
                />
                <Metric
                    icon={<ListOrdered size={15} />}
                    title="Paradas por ruta"
                    value={avgStopsPerRoute.toFixed(1)}
                    description="Promedio de los últimos 30 días"
                />
            </div>
            <GrowthChart
                title="Rutas por día en los últimos 14 días"
                data={metrics?.routesPerDay ?? []}
                emptyMessage="Todavía no hay rutas registradas."
            />
        </div>
    );
}
