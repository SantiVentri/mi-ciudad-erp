import type { AdminRoute, RouteStop } from "@/modules/routes/routes.dal";
import type { BusySlot, MapStop } from "@/modules/routes/routes.types";
import { TRIP_NUMBERS } from "@/modules/routes/routes.constants";

type Client = NonNullable<NonNullable<RouteStop["order"]>["client"]>;

export function getDriverFullName(driver: AdminRoute["driver"]) {
    if (!driver) return "Conductor sin perfil";

    const fullName =
        `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim();
    return fullName || driver.email;
}

// "Juan Pérez / Pedro Gómez" (conductor / acompañante)
export function getRouteCrew(route: AdminRoute) {
    const driver = getDriverFullName(route.driver);
    return route.co_driver
        ? `${driver} / ${getDriverFullName(route.co_driver)}`
        : driver;
}

export function getVehiclePatent(vehicle: AdminRoute["vehicle"]) {
    return vehicle?.patent ?? "Vehículo eliminado";
}

export function formatClientAddress(client?: Client | null) {
    if (!client) return "Sin dirección";
    return `${client.street} ${client.number}, ${client.city}`;
}

export function getSortedStops(route: AdminRoute): RouteStop[] {
    return [...(route.stops ?? [])].sort((a, b) => a.visit_order - b.visit_order);
}

export function getStopUnits(stop: RouteStop) {
    return (
        stop.order?.order_details?.reduce(
            (sum, detail) => sum + (detail.quantity ?? 0),
            0,
        ) ?? 0
    );
}

export function getRouteUnits(route: AdminRoute) {
    return (route.stops ?? []).reduce((sum, stop) => sum + getStopUnits(stop), 0);
}

export function hasCoordinates(client?: Client | null) {
    return client?.latitude != null && client?.longitude != null;
}

/**
 * Separa las paradas que se pueden dibujar en el mapa de las que no
 * (clientes sin latitud/longitud). El número de cada parada coincide con
 * su posición en la lista, así el marcador y el listado dicen lo mismo.
 */
export function getRouteMapData(route: AdminRoute) {
    const located: MapStop[] = [];
    let missing = 0;

    getSortedStops(route).forEach((stop, index) => {
        const client = stop.order?.client;

        if (client && client.latitude != null && client.longitude != null) {
            located.push({
                id: stop.id,
                number: index + 1,
                clientName: client.name,
                address: formatClientAddress(client),
                latitude: Number(client.latitude),
                longitude: Number(client.longitude),
            });
        } else {
            missing += 1;
        }
    });

    return { located, missing };
}

export function matchesRouteSearch(route: AdminRoute, term: string) {
    if (!term) return true;

    const haystack = [
        `ruta ${route.route_number}`,
        String(route.route_number),
        getDriverFullName(route.driver),
        route.driver?.email,
        route.co_driver ? getDriverFullName(route.co_driver) : null,
        getVehiclePatent(route.vehicle),
        ...(route.stops ?? []).map((stop) => stop.order?.client?.name),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return haystack.includes(term.toLowerCase());
}

/**
 * Primera vuelta del día en la que el conductor, el acompañante y el vehículo
 * están libres. null si están ocupados en todas.
 */
export function pickFreeTrip(
    busySlots: BusySlot[],
    driverId: string,
    coDriverId: string,
    vehicleId: string,
) {
    const people = [driverId, coDriverId];

    const trip = TRIP_NUMBERS.find(
        (tripNumber) =>
            !busySlots.some(
                (slot) =>
                    slot.trip_number === tripNumber &&
                    (people.includes(slot.driver_id) ||
                        (slot.co_driver_id !== null &&
                            people.includes(slot.co_driver_id)) ||
                        slot.vehicle_id === vehicleId),
            ),
    );

    return trip ?? null;
}

// "YYYY-MM-DD" del día siguiente (sin depender de la zona horaria)
export function nextDayKey(dateKey: string) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return next.toISOString().slice(0, 10);
}
