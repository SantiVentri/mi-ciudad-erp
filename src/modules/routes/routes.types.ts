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

// Ruta activa de un día, para saber qué choferes y vehículos ya están ocupados en cada vuelta
export type BusySlot = {
    trip_number: number;
    driver_id: string;
    co_driver_id: string | null;
    vehicle_id: string;
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
    busySlots: BusySlot[];
};

export type GenerateRouteInput = {
    date: string;
    driverId: string;
    coDriverId: string;
    vehicleId: string;
};

export type GenerateRouteResult = {
    routeNumber: number | null;
    tripNumber: number;
    stopsCount: number;
    excludedCount: number;
    optimized: boolean;
};
