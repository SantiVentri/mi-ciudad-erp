import type { RouteAssignment, Vehicle } from "@/modules/transports/transports.dal";
import type { Driver, DriverInviteFormValues, VehicleFormValues } from "@/modules/transports/transports.types";

// --- Vehículos ---

export function getVehicleStatus(vehicle: Vehicle): "Activo" | "Inactivo" {
    return vehicle.is_active === false ? "Inactivo" : "Activo";
}

export function getVehicleFormValues(vehicle?: Vehicle | null): VehicleFormValues {
    return {
        patent: vehicle?.patent ?? "",
    };
}

export function matchesVehicleSearch(vehicle: Vehicle, term: string) {
    if (!term) return true;
    return vehicle.patent.toLowerCase().includes(term.toLowerCase());
}

// --- Conductores ---

export function getDriverStatus(driver: Driver): "Activo" | "Inactivo" {
    return driver.is_active ? "Activo" : "Inactivo";
}

export function canToggleDriverStatus(driver: Driver) {
    return driver !== null;
}

export function getDriverName(driver: Driver) {
    if (!driver) return driver;

    const fullName = `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim();
    return fullName || driver.email;
}

export function matchesDriverSearch(driver: Driver, term: string) {
    if (!term) return true;

    const haystack = [driver.email, driver?.first_name, driver?.last_name, driver?.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return haystack.includes(term.toLowerCase());
}

export function getDriverInviteFormValues(): DriverInviteFormValues {
    return { email: "" };
}

// --- Asignaciones (derivadas de routes, solo lectura) ---

export function formatRouteDate(routeDate: string) {
    const [year, month, day] = routeDate.split("-");
    if (!year || !month || !day) return routeDate;
    return `${day}/${month}/${year}`;
}

export type AssignmentMaps = {
    byVehicleId: Map<string, RouteAssignment>;
    byDriverId: Map<string, RouteAssignment>;
};

export function buildAssignmentMaps(assignments: RouteAssignment[]): AssignmentMaps {
    const byVehicleId = new Map<string, RouteAssignment>();
    const byDriverId = new Map<string, RouteAssignment>();

    for (const assignment of assignments) {
        if (!byVehicleId.has(assignment.vehicle_id)) {
            byVehicleId.set(assignment.vehicle_id, assignment);
        }
        if (!byDriverId.has(assignment.driver_id)) {
            byDriverId.set(assignment.driver_id, assignment);
        }
    }

    return { byVehicleId, byDriverId };
}

export function getVehicleAssignmentLabel(
    vehicle: Vehicle,
    maps: AssignmentMaps,
    drivers: Driver[],
): string {
    const assignment = maps.byVehicleId.get(vehicle.id);
    if (!assignment) return "Sin asignaciones";

    const driver = drivers.find((candidate) => candidate?.id === assignment.driver_id);
    const driverName = driver ? getDriverName(driver) : "Conductor sin perfil";

    return `${driverName} · ${formatRouteDate(assignment.route_date)}`;
}

export function getDriverAssignmentLabel(
    driver: Driver,
    maps: AssignmentMaps,
    vehicles: Vehicle[],
): string {
    if (!driver) return "Sin registrar";

    const assignment = maps.byDriverId.get(driver.id);
    if (!assignment) return "Sin asignaciones";

    const vehicle = vehicles.find((candidate) => candidate.id === assignment.vehicle_id);
    const patent = vehicle?.patent ?? "vehículo eliminado";

    return `${patent} · ${formatRouteDate(assignment.route_date)}`;
}
