// Styles
import styles from "./routesMetrics.module.css";

// Components
import Metric from "@/components/ui/admin/dashboard/metric/Metric";
import GrowthChart from "@/components/ui/admin/dashboard/growthChart/GrowthChart";

// Data
import { getRoutesMetrics } from "@/modules/routes/routes.dal";
import { getDurationVariance } from "@/modules/costs/costs.dal";

// Utils
import { formatVariance } from "@/modules/costs/costs.utils";

// Icons
import { Clock, Package, Route, TriangleAlert } from "lucide-react";

const pctFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export default async function RoutesMetrics() {
    const [metrics, durationVariance] = await Promise.all([getRoutesMetrics(), getDurationVariance()]);

    const routesToday = metrics?.routesToday ?? 0;
    const unassignedOrders = metrics?.unassignedOrders ?? 0;
    const todayStops = metrics?.todayStops ?? 0;
    const todayCompletedStops = metrics?.todayCompletedStops ?? 0;
    const failedRate = metrics?.failedDeliveryRate ?? null;
    const variance = durationVariance?.avgVarianceMin ?? null;
    const routesMeasured = durationVariance?.routesMeasured ?? 0;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Route size={15} />}
                    title="Rutas de hoy"
                    value={routesToday}
                    description={
                        todayStops > 0
                            ? `${todayCompletedStops} de ${todayStops} ${todayStops === 1 ? "parada entregada" : "paradas entregadas"}`
                            : "Rutas programadas para hoy"
                    }
                />
                <Metric
                    icon={<Package size={15} />}
                    title="Pedidos sin ruta"
                    value={unassignedOrders}
                    description="Pendientes de hoy y los próximos 8 días sin asignar"
                />
                <Metric
                    icon={<TriangleAlert size={15} />}
                    title="Entregas fallidas"
                    value={failedRate != null ? `${pctFormatter.format(failedRate)} %` : "Sin datos"}
                    description={
                        metrics && metrics.visitedStops > 0
                            ? `${metrics.failedStops} de ${metrics.visitedStops} paradas visitadas en 30 días`
                            : "Aparece cuando los conductores marquen paradas"
                    }
                />
                <Metric
                    icon={<Clock size={15} />}
                    title="Desvío de duración"
                    value={variance != null ? formatVariance(variance) : "Sin datos"}
                    description={
                        routesMeasured > 0
                            ? `Real vs estimado, promedio de ${routesMeasured} ${routesMeasured === 1 ? "ruta finalizada" : "rutas finalizadas"} en 30 días`
                            : "Aparece cuando se finalicen rutas con estimación"
                    }
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
