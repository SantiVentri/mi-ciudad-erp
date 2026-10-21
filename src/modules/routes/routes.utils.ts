import type { AdminRoute, AdminRouteStop, RouteStop } from "@/modules/routes/routes.dal";
import type { BusySlot, MapStop } from "@/modules/routes/routes.types";
import { TRIP_NUMBERS } from "@/modules/routes/routes.constants";
import { todayKeyAR } from "@/utils/dates/argentina";
import { DEPOT } from "@/modules/routes/routes.depot";

type AdminClient = NonNullable<NonNullable<AdminRouteStop["order"]>["client"]>;

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

export function formatRouteClientAddress(client?: AdminClient | null) {
    if (!client) return "Sin dirección";
    return `${client.street} ${client.number ?? ""}, ${client.city}`;
}

export function getSortedStops(route: AdminRoute): AdminRouteStop[] {
    return [...(route.stops ?? [])].sort((a, b) => a.visit_order - b.visit_order);
}

export function getStopUnits(stop: AdminRouteStop) {
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

export function hasCoordinates(client?: AdminClient | null) {
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
                address: formatRouteClientAddress(client),
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

// --- Conductor: ruta del día ---

type Client = NonNullable<NonNullable<RouteStop["order"]>["client"]>;

export function sortStopsByVisitOrder(stops: RouteStop[]) {
  return [...stops].sort((a, b) => a.visitOrder - b.visitOrder);
}

export function formatRouteDate(dateValue: string) {
  const datePart = dateValue.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const formatted = date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatClientAddress(client: Client | null | undefined) {
  if (!client) return "Dirección no disponible";

  const parts = [`${client.street} ${client.number ?? ""}`.trim(), client.city, client.province].filter(
    Boolean
  );

  return parts.join(", ");
}

export function getRouteProgress(stops: RouteStop[]) {
  const total = stops.length;
  const completed = stops.filter((stop) => stop.state === "Completada").length;
  const failed = stops.filter((stop) => stop.state === "Entrega fallida").length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, failed, percentage };
}

export function isPastRoute(routeDate: string) {
  // route_date es medianoche UTC del día de la ruta; se compara contra hoy en Argentina
  return routeDate.slice(0, 10) < todayKeyAR();
}

export function isStopCompleted(stop: RouteStop) {
  return stop.state === "Completada";
}

// Google Maps acepta hasta 9 paradas intermedias en la app (y en la compu), pero
// solo 3 si el link se abre en el navegador del celular sin la app instalada.
// Se usa 9 porque los conductores abren el link en la app de Google Maps.
// Si hay más paradas, el link lleva por tramos: las próximas paradas pendientes
// y, cuando quedan pocas, el regreso a la embotelladora.
// https://developers.google.com/maps/documentation/urls/get-started#directions-action
const MAPS_MAX_WAYPOINTS = 9;

function isPendingStop(stop: RouteStop) {
  return stop.state !== "Completada" && stop.state !== "Entrega fallida";
}

function hasClientCoordinates(client: Client | null | undefined): client is Client & {
  latitude: number;
  longitude: number;
} {
  return client?.latitude != null && client?.longitude != null;
}

// Coordenadas si el cliente las tiene (no hay ambigüedad); si no, la dirección completa
function toMapsPoint(client: Client | null | undefined) {
  if (hasClientCoordinates(client)) {
    return `${Number(client.latitude)},${Number(client.longitude)}`;
  }
  if (!client?.street) return null;

  return [`${client.street} ${client.number ?? ""}`.trim(), client.city, client.province, "Argentina"]
    .filter(Boolean)
    .join(", ");
}

/**
 * Link de Google Maps para el próximo tramo de la ruta. Sin origen: Maps arranca
 * desde la ubicación del celular. `stopsCount` son las paradas incluidas y
 * `remaining` las pendientes que quedan para el siguiente tramo.
 */
export function buildDriverMapsLink(stops: RouteStop[]) {
  const points = stops
    .filter(isPendingStop)
    .map((stop) => toMapsPoint(stop.order?.client))
    .filter((point): point is string => point !== null);

  const depot = `${DEPOT.latitude},${DEPOT.longitude}`;

  // Si entran todas, se termina en la embotelladora; si no, en la última parada del tramo
  const fitsAll = points.length <= MAPS_MAX_WAYPOINTS;
  const segment = fitsAll ? points : points.slice(0, MAPS_MAX_WAYPOINTS + 1);
  const destination = fitsAll ? depot : segment[segment.length - 1];
  const waypoints = fitsAll ? segment : segment.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }

  return {
    url: `https://www.google.com/maps/dir/?${params.toString()}`,
    stopsCount: segment.length,
    remaining: points.length - segment.length,
    returnsToDepot: fitsAll,
  };
}

// Paradas con coordenadas para el mapa de previsualización (número = posición en la lista)
export function getDriverMapStops(stops: RouteStop[]) {
  const located: MapStop[] = [];
  let missing = 0;

  stops.forEach((stop, index) => {
    const client = stop.order?.client;

    if (hasClientCoordinates(client)) {
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
