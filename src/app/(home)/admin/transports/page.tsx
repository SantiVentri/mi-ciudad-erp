import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import TransportsView from "@/components/ui/admin/transports/TransportsView";
import {
    getDrivers,
    getRouteAssignments,
    getVehicles,
    getVehiclesMetrics,
    getTopVehiclesByRoutes,
    getDriversMetrics,
    getTopDriversByRoutes,
} from "@/modules/transports/transports.dal";

export default async function TransportsPage() {
    const [
        vehicles,
        drivers,
        assignments,
        vehiclesMetrics,
        topVehicles,
        driversMetrics,
        topDrivers,
    ] = await Promise.all([
        getVehicles(),
        getDrivers(),
        getRouteAssignments(),
        getVehiclesMetrics(),
        getTopVehiclesByRoutes(5),
        getDriversMetrics(),
        getTopDriversByRoutes(5),
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
                vehiclesMetrics={vehiclesMetrics}
                topVehicles={topVehicles ?? []}
                driversMetrics={driversMetrics}
                topDrivers={topDrivers ?? []}
            />
        </div>
    )
}