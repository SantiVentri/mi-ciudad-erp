import { getOrders, getOrdersMetrics, getMonthlyOrdersGrowth, getNewOrderOptions, getOrdersPage } from "@/modules/orders/orders.dal";
import OrdersView from "@/modules/orders/components/OrdersView";
import { Suspense } from "react";
import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import MetricsSkeleton from "@/components/ui/skeleton/MetricsSkeleton";
import OrdersMetrics from "@/modules/orders/components/ordersMetrics/OrdersMetrics";
import {
  ALL_ORDERS_PAGE_SIZE,
  ALL_ORDERS_VIEW,
  DAYS_BEFORE,
  DAYS_AFTER,
  STATE_OPTIONS,
} from "@/modules/orders/orders.constants";
import { dayKey } from "@/modules/orders/orders.utils";
import { todayAR } from "@/utils/dates/argentina";

export const metadata = {
  title: "Pedidos",
  description: "Revisá, filtrá y gestioná los pedidos desde este panel.",
};

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  // Las métricas se piden ya, en paralelo con los pedidos; OrdersMetrics reusa el resultado (cache)
  getOrdersMetrics().catch(() => {});
  getMonthlyOrdersGrowth(6).catch(() => {});

  const today = todayAR();

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - DAYS_BEFORE);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + DAYS_AFTER);

  const params = await searchParams;

  // ?vista=todos&pagina=2&q=...&estado=... : todos los pedidos, paginados en el servidor
  const isAllView = param(params.vista) === ALL_ORDERS_VIEW;
  const allSearch = param(params.q) ?? "";
  const stateParam = param(params.estado);
  const allState = stateParam && STATE_OPTIONS.includes(stateParam) && stateParam !== "Todos" ? stateParam : null;
  const allPage = Number(param(params.pagina)) || 1;

  const [orders, newOrderOptions, ordersPage] = await Promise.all([
    getOrders(dayKey(startDate), dayKey(endDate)),
    getNewOrderOptions(),
    isAllView ? getOrdersPage(allPage, ALL_ORDERS_PAGE_SIZE, allState, allSearch) : null,
  ]);

  // ?pedido=<id> llega desde las paradas de Rutas: se abre ese pedido en su día
  const focusOrderId = param(params.pedido);

  return (
    <div>
      <AdminPageHeader
        title="Pedidos"
        description="Revisá, filtrá y gestioná los pedidos desde este panel."
      />
      <Suspense fallback={<MetricsSkeleton />}>
        <OrdersMetrics />
      </Suspense>
      <OrdersView
        orders={orders ?? []}
        newOrderOptions={newOrderOptions ?? { clients: [], products: [] }}
        focusOrderId={focusOrderId}
        allOrders={
          ordersPage
            ? { ...ordersPage, search: allSearch, state: allState ?? "Todos" }
            : null
        }
      />
    </div>
  );
}
