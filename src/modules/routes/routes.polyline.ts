import "server-only";
import { createHash } from "node:crypto";

// Huella y compresión del recorrido por calles de una ruta (tabla route_paths)

type Point = { latitude: number; longitude: number };

/**
 * Huella de los puntos del recorrido (depósito → paradas en orden → depósito).
 * Si cambian las paradas, su orden o una ubicación, cambia la huella y el
 * recorrido guardado deja de servir.
 */
export function routePointsKey(points: Point[]) {
    const text = points
        .map((point) => `${Number(point.latitude).toFixed(6)},${Number(point.longitude).toFixed(6)}`)
        .join(";");
    return createHash("sha1").update(text).digest("hex");
}

const PRECISION = 1e5; // 5 decimales ≈ 1 m

function encodeValue(value: number) {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let out = "";
    while (v >= 0x20) {
        out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
        v >>= 5;
    }
    return out + String.fromCharCode(v + 63);
}

// Google Encoded Polyline (precisión 5). path: pares [lat, lng]
export function encodePolyline(path: [number, number][]) {
    let lastLat = 0;
    let lastLng = 0;
    let out = "";
    for (const [lat, lng] of path) {
        const latE5 = Math.round(lat * PRECISION);
        const lngE5 = Math.round(lng * PRECISION);
        out += encodeValue(latE5 - lastLat) + encodeValue(lngE5 - lastLng);
        lastLat = latE5;
        lastLng = lngE5;
    }
    return out;
}

// Devuelve pares [lat, lng]
export function decodePolyline(encoded: string): [number, number][] {
    const path: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    const next = () => {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        return result & 1 ? ~(result >> 1) : result >> 1;
    };

    while (index < encoded.length) {
        lat += next();
        lng += next();
        path.push([lat / PRECISION, lng / PRECISION]);
    }
    return path;
}
