// Styles
import styles from "./ordersMetrics.module.css";

// Components
import Metric from "@/components/ui/admin/dashboard/metric/Metric";
import OrdersGrowthChart from "./OrdersGrowthChart";

// Data
import { getMonthlyOrdersGrowth, getOrdersMetrics } from "@/modules/orders/orders.dal";

// Utils
import { formatCurrency } from "@/modules/costs/costs.utils";

// Icons
import { CircleCheck, CircleDollarSign, Receipt, TriangleAlert } from "lucide-react";

const pctFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" });

// "+12,3 %" / "−4 %"
function formatChange(pct: number) {
    const formatted = pctFormatter.format(Math.abs(pct));
    if (formatted === "0") return "igual";
    return `${pct > 0 ? "+" : "−"}${formatted} %`;
}

export default async function OrdersMetrics() {
    const [metrics, monthlyGrowth] = await Promise.all([
        getOrdersMetrics(),
        getMonthlyOrdersGrowth(6),
    ]);

    const salesOrders = metrics?.monthSalesOrders ?? 0;
    const unpricedLines = metrics?.unpricedLines ?? 0;
    const previousMonth = metrics
        ? monthFormatter.format(new Date(`${metrics.previousMonthStart}T00:00:00Z`))
        : "";

    // Ventas: comparación con el mismo tramo del mes anterior, o aviso de renglones sin precio
    const salesDescription =
        unpricedLines > 0
            ? `No incluye ${unpricedLines} ${unpricedLines === 1 ? "renglón" : "renglones"} sin precio registrado`
            : metrics?.salesChangePct != null
              ? `${formatChange(metrics.salesChangePct)} vs. el mismo período de ${previousMonth}`
              : `${salesOrders} ${salesOrders === 1 ? "pedido entregado" : "pedidos entregados"} este mes`;

    const overdue = metrics?.overdueOrders ?? 0;
    const canceled = metrics?.canceledOrders ?? 0;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<CircleDollarSign size={15} />}
                    title="Ventas del mes"
                    value={formatCurrency(Math.round(metrics?.monthSales ?? 0))}
                    description={salesDescription}
                />
                <Metric
                    icon={<Receipt size={15} />}
                    title="Ticket promedio"
                    value={metrics?.avgTicket != null ? formatCurrency(Math.round(metrics.avgTicket)) : "Sin datos"}
                    description={
                        salesOrders > 0
                            ? `Por pedido entregado este mes (${salesOrders} ${salesOrders === 1 ? "pedido" : "pedidos"})`
                            : "Aparece cuando se entreguen pedidos este mes"
                    }
                />
                <Metric
                    icon={<CircleCheck size={15} />}
                    title="Entregas cumplidas"
                    value={metrics?.deliveryRate != null ? `${pctFormatter.format(metrics.deliveryRate)} %` : "Sin datos"}
                    description={
                        metrics && metrics.dueOrders > 0
                            ? `${metrics.deliveredOrders} de ${metrics.dueOrders} pedidos de los últimos 30 días${canceled > 0 ? ` · ${canceled} ${canceled === 1 ? "cancelado" : "cancelados"} aparte` : ""}`
                            : "Pedidos con entrega en los últimos 30 días"
                    }
                />
                <Metric
                    icon={<TriangleAlert size={15} />}
                    title="Pedidos atrasados"
                    value={overdue}
                    description={
                        overdue > 0
                            ? "Con fecha pasada y sin entregar: reprogramalos"
                            : "Ninguno: todo al día"
                    }
                />
            </div>
            <OrdersGrowthChart data={monthlyGrowth ?? []} />
        </div>
    );
}
