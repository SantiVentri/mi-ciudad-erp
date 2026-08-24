import { getOrders } from "@/modules/orders/orders.dal";
import OrdersView from "@/components/ui/admin/orders/OrdersView";
import AdminPageHeader from "@/components/ui/admin/header/AdminPageHeader";
import OrdersMetrics from "@/components/ui/admin/orders/ordersMetrics/OrdersMatrics";
import { DAYS_BEFORE, DAYS_AFTER } from "@/modules/orders/orders.constants";
import { dayKey, startOfDay } from "@/modules/orders/orders.utils";

export default async function OrdersPage() {
    const today = startOfDay(new Date());

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - DAYS_BEFORE);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + DAYS_AFTER);

    const orders = await getOrders(dayKey(startDate), dayKey(endDate));

    return (
        <div>
            <AdminPageHeader
                title="Pedidos"
                description="Revisá, filtrá y gestioná los pedidos desde este panel."
            />
            <OrdersMetrics />
            <OrdersView orders={orders ?? []} />
        </div>
    );
}