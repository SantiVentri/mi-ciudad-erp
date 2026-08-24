import { getOrders } from "@/modules/orders/orders.dal";
import OrdersView from "@/components/ui/admin/orders/OrdersView";
import AdminPageHeader from "@/components/ui/admin/header/AdminPageHeader";
import OrdersMetrics from "@/components/ui/admin/orders/ordersMetrics/OrdersMatrics";

export default async function OrdersPage() {
    const orders = await getOrders();

    return (
        <div>
            <AdminPageHeader
                title="Pedidos"
                description="Revisá, filtrá y gestioná los pedidos desde este panel."
            />
            <OrdersMetrics orders={orders ?? []} />
            <OrdersView orders={orders ?? []} />
        </div>
    );
}