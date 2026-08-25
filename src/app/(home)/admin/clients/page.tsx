// Utils
import { getClients, getTopClientsByOrders } from "@/modules/clients/clients.dal";

// Components
import ClientsView from "@/modules/clients/components/ClientsView";
import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import ClientsMetrics from "@/modules/clients/components/ClientsMetrics";

export default async function ClientsPage() {
    const [clients, topClients] = await Promise.all([
        getClients(),
        getTopClientsByOrders(6),
    ]);

    return (
        <div>
            <AdminPageHeader
                title="Clientes"
                description="Consultá y administrá los clientes registrados en el sistema."
            />
            <ClientsMetrics clients={clients ?? []} topClients={topClients ?? []} />
            <ClientsView clients={clients ?? []} />
        </div>
    );
}