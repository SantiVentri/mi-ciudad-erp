import AdminPageHeader from "@/components/ui/admin/header/AdminPageHeader";
import TransportsView from "@/components/ui/admin/transports/TransportsView";
import { getDrivers, getRouteAssignments, getVehicles } from "@/modules/transports/transports.dal";

export default async function TransportsPage() {
    const [vehicles, drivers, assignments] = await Promise.all([
        getVehicles(),
        getDrivers(),
        getRouteAssignments(),
    ]);

    return (
        <div>
            <AdminPageHeader
                title="Vehículos y conductores"
                description="Controlá la flota y asigná conductores desde un mismo lugar."
            />
            <TransportsView
                vehicles={vehicles ?? []}
                drivers={drivers ?? []}
                assignments={assignments ?? []}
            />
        </div>
    )
}