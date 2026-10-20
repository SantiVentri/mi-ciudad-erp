import "server-only";

type Coordinates = {
  latitude: number | null;
  longitude: number | null;
};

const EMPTY_COORDINATES: Coordinates = { latitude: null, longitude: null };

// Nominatim (OpenStreetMap) es gratis pero pide un User-Agent que identifique a la app
// con un contacto, y como máximo 1 pedido por segundo.
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ?? "MiCiudadERP/1.0 (contacto no configurado)";

export async function geocodeAddress(
  street: string,
  number: string,
  city: string,
  province: string,
): Promise<Coordinates> {
  const query = `${street} ${number}, ${city}, ${province}, Argentina`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ar`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (!response.ok) return EMPTY_COORDINATES;

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error("Error geocodificando la dirección:", error);
  }

  return EMPTY_COORDINATES;
}
