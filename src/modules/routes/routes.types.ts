import { Database } from "@/utils/supabase/database.types";

export type RouteRow = Database["public"]["Tables"]["routes"]["Row"];
export type RouteInsert = Database["public"]["Tables"]["routes"]["Insert"];
export type RouteUpdate = Database["public"]["Tables"]["routes"]["Update"];

export type StopRow = Database["public"]["Tables"]["stops"]["Row"];
export type StopInsert = Database["public"]["Tables"]["stops"]["Insert"];
export type StopUpdate = Database["public"]["Tables"]["stops"]["Update"];

// Parada con coordenadas, lista para dibujarse en el mapa
export type MapStop = {
    id: string;
    number: number;
    clientName: string;
    address: string;
    latitude: number;
    longitude: number;
};

// Opción de los selects del modal de generar ruta
export type SelectOption = {
    id: string;
    label: string;
};

// Pedido que no entra en la ruta porque el cliente no tiene coordenadas
export type ExcludedOrder = {
    orderId: string;
    clientName: string;
    address: string;
};

export type RouteGenerationPreview = {
    date: string;
    ordersCount: number;
    excluded: ExcludedOrder[];
};

export type GenerateRouteInput = {
    date: string;
    driverId: string;
    coDriverId: string;
    vehicleId: string;
};

export type GenerateRouteResult = {
    routeNumber: number | null;
    stopsCount: number;
    excludedCount: number;
    optimized: boolean;
    // Qué dato falta para calcular el costo (la ruta se crea igual). null si se calculó.
    costWarning: string | null;
};

export type EditRouteInput = {
    routeId: string;
    date: string;
    driverId: string;
    coDriverId: string;
    vehicleId: string;
};

// Pedidos de un día (todos los estados) y cuántos siguen sin ruta
export type DayOrdersStatus = {
    total: number;
    pending: number;
};
