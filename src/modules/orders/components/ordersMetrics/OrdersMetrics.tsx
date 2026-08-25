// Styles
import styles from "./ordersMetrics.module.css";

// Components
import Metric from "@/components/ui/admin/dashboard/metric/Metric";
import OrdersGrowthChart from "./OrdersGrowthChart";

// Data
import { getMonthlyOrdersGrowth, getOrdersMetrics } from "@/modules/orders/orders.dal";

// Icons
import { Box } from "lucide-react";

export default async function OrdersMetrics() {
    const [metrics, monthlyGrowth] = await Promise.all([
        getOrdersMetrics(),
        getMonthlyOrdersGrowth(6),
    ]);

    const totalOrders = metrics?.totalOrders ?? 0;
    const completedOrdersPercentage = metrics?.completedOrdersPercentage ?? 0;
    const pendingOrders = metrics?.pendingOrders ?? 0;
    const canceledOrders = metrics?.canceledOrders ?? 0;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Box size={15} />}
                    title="Pedidos totales"
                    value={totalOrders}
                    description="Total de pedidos este año"
                />
                <Metric
                    icon={<Box size={15} />}
                    title="% de entregas exitosas"
                    value={completedOrdersPercentage.toFixed(2) + "%"}
                    description="este año"
                />
                <Metric
                    icon={<Box size={15} />}
                    title="Asignaciones pendientes"
                    value={pendingOrders}
                    description="Pedidos pendientes de asignación de ruta"
                />
                <Metric
                    icon={<Box size={15} />}
                    title="Pedidos cancelados"
                    value={canceledOrders}
                    description="Pedidos cancelados por el usuario este año"
                />
            </div>
            <OrdersGrowthChart data={monthlyGrowth ?? []} />
        </div>
    )
}