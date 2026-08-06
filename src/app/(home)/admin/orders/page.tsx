import { getOrders } from "@/modules/orders/orders.dal";
import OrdersView from "@/components/ui/admin/orders/OrdersView";

export default async function OrdersPage() {
    const orders = await getOrders();

    return (
        <div>
            <h1>Pedidos</h1>
            <OrdersView orders={orders ?? []} />
        </div>
    );
}