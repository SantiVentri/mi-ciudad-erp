import { getOrders, getOrdersMetrics, getMonthlyOrdersGrowth } from "@/modules/orders/orders.dal";
import OrdersView from "@/modules/orders/components/OrdersView";
import { Suspense } from "react";
import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import MetricsSkeleton from "@/components/ui/skeleton/MetricsSkeleton";
import OrdersMetrics from "@/modules/orders/components/ordersMetrics/OrdersMetrics";
import { DAYS_BEFORE, DAYS_AFTER } from "@/modules/orders/orders.constants";
import { dayKey } from "@/modules/orders/orders.utils";
import { todayAR } from "@/utils/dates/argentina";

export const metadata = {
  title: "Pedidos",
  description: "Revisá, filtrá y gestioná los pedidos desde este panel.",
};

export default async function OrdersPage() {
  // Las métricas se piden ya, en paralelo con los pedidos; OrdersMetrics reusa el resultado (cache)
  getOrdersMetrics().catch(() => {});
  getMonthlyOrdersGrowth(6).catch(() => {});

  const today = todayAR();

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
      <Suspense fallback={<MetricsSkeleton />}>
        <OrdersMetrics />
      </Suspense>
      <OrdersView orders={orders ?? []} />
    </div>
  );
}
