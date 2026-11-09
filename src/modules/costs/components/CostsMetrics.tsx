// Styles
import styles from "./costs.module.css";

// Components
import Metric from "@/components/ui/admin/dashboard/metric/Metric";
import GrowthChart from "@/components/ui/admin/dashboard/growthChart/GrowthChart";

// Data
import { getCostsMetrics } from "@/modules/costs/costs.dal";
import { COSTS_CHART_DAYS } from "@/modules/costs/costs.constants";

// Utils
import {
    formatCurrency,
    formatDayKey,
    formatKm,
    formatNumber,
    formatVariance,
} from "@/modules/costs/costs.utils";

// Icons
import { Calculator, Clock, Droplets, Fuel, Gauge, Receipt } from "lucide-react";

export default async function CostsMetrics() {
    const metrics = await getCostsMetrics();

    const fuelPrice = metrics?.currentFuelPrice ?? null;
    const variance = metrics?.avgDurationVarianceMin ?? null;
    const routesWithCost = metrics?.routesWithCost ?? 0;
    const routesLabel = `${routesWithCost} ${routesWithCost === 1 ? "ruta" : "rutas"}`;

    // "42,5 l · 63 km" por ruta
    const fuelDetail = [
        metrics?.avgLitersPerRoute != null
            ? `${formatNumber(Math.round(metrics.avgLitersPerRoute * 10) / 10)} l`
            : null,
        metrics?.avgKmPerRoute != null ? formatKm(Math.round(metrics.avgKmPerRoute)) : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Calculator size={15} />}
                    title="Costo promedio por ruta"
                    value={
                        metrics?.avgCostPerRoute != null
                            ? formatCurrency(Math.round(metrics.avgCostPerRoute))
                            : "Sin datos"
                    }
                    description={
                        routesWithCost > 0
                            ? `Combustible, mano de obra y gastos. Promedio de ${routesLabel} en 30 días`
                            : "Aparece cuando haya rutas con costo calculado"
                    }
                />
                <Metric
                    icon={<Droplets size={15} />}
                    title="Combustible promedio por ruta"
                    value={
                        metrics?.avgFuelCostPerRoute != null
                            ? formatCurrency(Math.round(metrics.avgFuelCostPerRoute))
                            : "Sin datos"
                    }
                    description={
                        routesWithCost > 0
                            ? `Estimado${fuelDetail ? ` (${fuelDetail})` : ""}. Promedio de ${routesLabel} en 30 días`
                            : "Aparece cuando haya rutas con costo calculado"
                    }
                />
                <Metric
                    icon={<Fuel size={15} />}
                    title="Precio del combustible vigente"
                    value={fuelPrice ? formatCurrency(fuelPrice.pricePerLiter) : "Sin cargar"}
                    description={
                        fuelPrice
                            ? `Por litro, desde el ${formatDayKey(fuelPrice.validFrom)}`
                            : "Cargalo en la pestaña Combustible"
                    }
                />
                <Metric
                    icon={<Gauge size={15} />}
                    title="Combustible por km"
                    value={metrics?.fuelCostPerKm != null ? formatCurrency(metrics.fuelCostPerKm) : "Sin datos"}
                    description={
                        metrics && metrics.vehiclesWithYield > 0
                            ? `Promedio de ${metrics.vehiclesWithYield} ${metrics.vehiclesWithYield === 1 ? "vehículo" : "vehículos"} con rendimiento cargado`
                            : "Cargá el rendimiento de los vehículos en Transportes"
                    }
                />
                <Metric
                    icon={<Clock size={15} />}
                    title="Desvío de duración"
                    value={variance != null ? formatVariance(variance) : "Sin datos"}
                    description={
                        metrics && metrics.finishedRoutesMeasured > 0
                            ? `Real vs estimado, promedio de ${metrics.finishedRoutesMeasured} ${metrics.finishedRoutesMeasured === 1 ? "ruta finalizada" : "rutas finalizadas"} en 30 días`
                            : "Aparece cuando se finalicen rutas con estimación"
                    }
                />
                <Metric
                    icon={<Receipt size={15} />}
                    title="Gastos extra"
                    value={formatCurrency(metrics?.totalExpenses ?? 0)}
                    description={
                        metrics && metrics.routesWithExpenses > 0
                            ? `Peajes y otros gastos de ${metrics.routesWithExpenses} ${metrics.routesWithExpenses === 1 ? "ruta" : "rutas"} en 30 días`
                            : "Peajes y otros gastos de los últimos 30 días"
                    }
                />
            </div>
            <div className={styles.chartSlot}>
                <GrowthChart
                    title={`Costo estimado más gastos por día (últimos ${COSTS_CHART_DAYS} días)`}
                    data={metrics?.estimatedCostPerDay ?? []}
                    emptyMessage="Todavía no hay rutas con costo calculado."
                />
            </div>
        </div>
    );
}
