// Utils
import {
  getClients,
  getClientsWithoutRecentOrders,
  getTopClientsByOrders,
} from "@/modules/clients/clients.dal";

// Components
import ClientsView from "@/modules/clients/components/ClientsView";
import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import ClientsMetrics from "@/modules/clients/components/ClientsMetrics";

export const metadata = {
  title: "Clientes",
  description: "Consultá y administrá los clientes registrados en el sistema.",
};

export default async function ClientsPage() {
  const [clients, topClients, withoutRecentOrders] = await Promise.all([
    getClients(),
    getTopClientsByOrders(6),
    getClientsWithoutRecentOrders(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Clientes"
        description="Consultá y administrá los clientes registrados en el sistema."
      />
      <ClientsMetrics
        clients={clients ?? []}
        topClients={topClients ?? []}
        withoutRecentOrders={withoutRecentOrders}
      />
      <ClientsView clients={clients ?? []} />
    </div>
  );
}
