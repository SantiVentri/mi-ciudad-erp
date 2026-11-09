// Styles
import styles from "./costs.module.css";

// Components
import Metric from "@/components/ui/admin/dashboard/metric/Metric";
import GrowthChart from "@/components/ui/admin/dashboard/growthChart/GrowthChart";

// Data
import { getCostsMetrics } from "@/modules/costs/costs.dal";
import { COSTS_CHART_DAYS } from "@/modules/costs/costs.constants";

// Utils
import { formatCurrency } from "@/modules/costs/costs.utils";

// Icons
import { Gauge, Percent, Receipt, Truck } from "lucide-react";

const pctFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export default async function CostsMetrics() {
    const metrics = await getCostsMetrics();

    const fuelPrice = metrics?.currentFuelPrice ?? null;
    const completedRoutes = metrics?.completedRoutes ?? 0;
    const deliveries = metrics?.deliveries ?? 0;
    const unpricedLines = metrics?.unpricedLines ?? 0;
    const routesLabel = `${completedRoutes} ${completedRoutes === 1 ? "ruta completada" : "rutas completadas"}`;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Truck size={15} />}
                    title="Costo por entrega"
                    value={
                        metrics?.costPerDelivery != null
                            ? formatCurrency(Math.round(metrics.costPerDelivery))
                            : "Sin datos"
                    }
                    description={
                        deliveries > 0 && metrics?.avgCostPerRoute != null
                            ? `${deliveries} entregas en ${routesLabel} (30 días). Ruta promedio: ${formatCurrency(Math.round(metrics.avgCostPerRoute))}`
                            : "Aparece cuando se completen rutas con costo calculado"
                    }
                />
                <Metric
                    icon={<Percent size={15} />}
                    title="Costo logístico sobre ventas"
                    value={
                        metrics?.logisticsCostPct != null
                            ? `${pctFormatter.format(metrics.logisticsCostPct)} %`
                            : "Sin datos"
                    }
                    description={
                        metrics?.logisticsCostPct != null
                            ? `${formatCurrency(Math.round(metrics.deliveredSales))} vendidos en ${routesLabel} (30 días)`
                            : unpricedLines > 0
                              ? `Hay ${unpricedLines} ${unpricedLines === 1 ? "renglón" : "renglones"} de pedidos sin precio registrado`
                              : "Aparece cuando se completen rutas con ventas"
                    }
                />
                <Metric
                    icon={<Gauge size={15} />}
                    title="Combustible por km"
                    value={metrics?.fuelCostPerKm != null ? formatCurrency(metrics.fuelCostPerKm) : "Sin datos"}
                    description={
                        !fuelPrice
                            ? "Cargá el precio del combustible en la pestaña Combustible"
                            : metrics && metrics.vehiclesWithYield > 0
                              ? `Promedio de ${metrics.vehiclesWithYield} ${metrics.vehiclesWithYield === 1 ? "vehículo" : "vehículos"} con rendimiento cargado`
                              : "Cargá el rendimiento de los vehículos en Transportes"
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
