// Punto de salida y regreso de los camiones.
// Las coordenadas vienen del .env (NEXT_PUBLIC_DEPOT_LATITUDE / NEXT_PUBLIC_DEPOT_LONGITUDE)
// porque las usan tanto el servidor (optimización) como el navegador (mapa).
// Si faltan, se usa el centro aproximado de Merlo para que el mapa no se rompa.
const FALLBACK_LATITUDE = -34.6654;
const FALLBACK_LONGITUDE = -58.7277;

function readCoordinate(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return value && Number.isFinite(parsed) ? parsed : fallback;
}

export const DEPOT = {
    name: "Embotelladora Mi Ciudad",
    address:
        process.env.NEXT_PUBLIC_COMPANY_ADDRESS ??
        "Pellegrini 805, B1722 Merlo, Provincia de Buenos Aires",
    latitude: readCoordinate(
        process.env.NEXT_PUBLIC_DEPOT_LATITUDE,
        FALLBACK_LATITUDE,
    ),
    longitude: readCoordinate(
        process.env.NEXT_PUBLIC_DEPOT_LONGITUDE,
        FALLBACK_LONGITUDE,
    ),
};
