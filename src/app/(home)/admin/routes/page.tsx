import { getOrdersStatusByDay, getRoutes } from "@/modules/routes/routes.dal";
import { getDrivers, getVehicles } from "@/modules/transports/transports.dal";
import RoutesView from "@/modules/routes/components/RoutesView";
import RoutesMetrics from "@/modules/routes/components/routesMetrics/RoutesMetrics";
import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import { DAYS_AFTER, DAYS_BEFORE } from "@/modules/routes/routes.constants";
import { dayKey } from "@/modules/orders/orders.utils";
import { todayAR } from "@/utils/dates/argentina";

export const metadata = {
  title: "Rutas",
  description:
    "Visualizá y organizá las rutas disponibles para la operación diaria.",
};

export default async function RoutesPage() {
  const today = todayAR();

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - DAYS_BEFORE);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + DAYS_AFTER);

  const [routes, ordersByDay, drivers, vehicles] = await Promise.all([
    getRoutes(dayKey(startDate), dayKey(endDate)),
    getOrdersStatusByDay(dayKey(startDate), dayKey(endDate)),
    getDrivers(),
    getVehicles(),
  ]);

  // Solo conductores y vehículos activos se pueden asignar a una ruta nueva
  const driverOptions = (drivers ?? [])
    .filter((driver) => driver.is_active === true)
    .map((driver) => ({
      id: driver.id,
      label:
        `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() ||
        driver.email,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const vehicleOptions = (vehicles ?? [])
    .filter((vehicle) => vehicle.is_active === true)
    .map((vehicle) => ({ id: vehicle.id, label: vehicle.patent }));

  return (
    <div>
      <AdminPageHeader
        title="Rutas"
        description="Visualizá y organizá las rutas disponibles para la operación diaria."
      />
      <RoutesMetrics />
      <RoutesView
        routes={routes ?? []}
        ordersByDay={ordersByDay ?? {}}
        drivers={driverOptions}
        vehicles={vehicleOptions}
      />
    </div>
  );
}
