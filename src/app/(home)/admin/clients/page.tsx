import { getClients } from "@/modules/clients/clients.dal";
import ClientsView from "@/components/ui/admin/clients/ClientsView";
import AdminPageHeader from "@/components/ui/admin/header/AdminPageHeader";

export default async function ClientsPage() {
    const clients = await getClients();

    return (
        <div>
            <AdminPageHeader
                title="Clientes"
                description="Consultá y administrá los clientes registrados en el sistema."
            />
            <ClientsView clients={clients ?? []} />
        </div>
    );
}