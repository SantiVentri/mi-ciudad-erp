// Utils
import { getClients, getTopClientsByOrders } from "@/modules/clients/clients.dal";

// Components
import ClientsView from "@/components/ui/admin/clients/ClientsView";
import AdminPageHeader from "@/components/ui/admin/header/AdminPageHeader";
import ClientsMetrics from "@/components/ui/admin/clients/ClientsMetrics";

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