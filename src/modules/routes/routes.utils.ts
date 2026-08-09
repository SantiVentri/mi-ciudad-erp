import type { RouteStop } from "@/modules/routes/routes.dal";

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

  const parts = [`${client.street} ${client.number}`, client.city, client.province].filter(
    Boolean
  );

  return parts.join(", ");
}

export function getRouteProgress(stops: RouteStop[]) {
  const total = stops.length;
  const completed = stops.filter((stop) => stop.state === "Completada").length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, percentage };
}

export function isStopCompleted(stop: RouteStop) {
  return stop.state === "Completada";
}

export function getPendingStopAddresses(stops: RouteStop[]) {
  return stops
    .filter((stop) => stop.state !== "Completada")
    .map((stop) => formatClientAddress(stop.order?.client))
    .filter(
      (address): address is string => Boolean(address) && address !== "Dirección no disponible"
    );
}

export function buildGoogleMapsRouteUrl(
  addresses: string[],
  options?: { origin?: string; destination?: string }
) {
  const cleanAddresses = addresses.filter(Boolean);
  const fixedOrigin = options?.origin;
  const fixedDestination = options?.destination;

  if (cleanAddresses.length === 0 && !fixedDestination) return null;

  const destination = fixedDestination ?? cleanAddresses[cleanAddresses.length - 1];
  const waypoints = fixedDestination ? cleanAddresses : cleanAddresses.slice(0, -1);

  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}&travelmode=driving`;

  if (fixedOrigin) {
    url += `&origin=${encodeURIComponent(fixedOrigin)}`;
  }

  if (waypoints.length > 0) {
    url += `&waypoints=${waypoints.map(encodeURIComponent).join("%7C")}`;
  }

  return url;
}