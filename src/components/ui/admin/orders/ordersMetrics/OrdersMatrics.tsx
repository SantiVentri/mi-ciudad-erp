// Styles
import styles from "./ordersMetrics.module.css";

// Components
import Metric from "../../dashboard/metric/Metric";
import OrdersGrowthChart from "./OrdersGrowthChart";

// Types
import { getMonthlyOrdersGrowth, Order } from "@/modules/orders/orders.dal";

// Icons
import { Box } from "lucide-react";

// Props
type OrdersMetricsProps = {
    orders: Order[];
};

export default async function OrdersMetrics({ orders }: OrdersMetricsProps) {
    const thisYear = new Date().getFullYear();
    const totalOrders = orders.filter((order) => {
        const orderYear = new Date(order.created_at).getFullYear();
        return orderYear === thisYear;
    }).length;

    const completedOrders = orders.filter((order) => {
        const orderYear = new Date(order.created_at).getFullYear();
        return orderYear === thisYear && order.state === "Completada";
    }).length;

    const pendingOrders = orders.filter((order) => {
        const orderYear = new Date(order.created_at).getFullYear();
        return orderYear === thisYear && order.state === "Pendiente";
    }).length;

    const canceledOrders = orders.filter((order) => {
        const orderYear = new Date(order.created_at).getFullYear();
        return orderYear === thisYear && order.state === "Cancelada";
    }).length;

    const completedOrdersPercentage = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    const monthlyGrowth = await getMonthlyOrdersGrowth(6);

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
                    value={completedOrdersPercentage + "%"}
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