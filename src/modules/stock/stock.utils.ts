import { MANUAL_MOVEMENT_TYPES, MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS } from "@/modules/stock/stock.constants";
import type {
    ManualMovementType,
    MovementType,
    Product,
    ProductStatusFilter,
    StockLevel,
} from "@/modules/stock/stock.types";

export function getStockLevel(product: Pick<Product, "stock" | "minStock">): StockLevel {
    if (product.stock <= 0) return "out";
    if (product.stock <= product.minStock) return "low";
    return "ok";
}

export function matchesStatus(product: Product, filter: ProductStatusFilter) {
    switch (filter) {
        case "Activo":
            return product.isActive;
        case "Deshabilitado":
            return !product.isActive;
        case "Stock bajo":
            return getStockLevel(product) === "low";
        case "Sin stock":
            return getStockLevel(product) === "out";
        default:
            return true;
    }
}

function normalize(value: string) {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesProductSearch(product: Product, search: string) {
    if (!search) return true;
    const needle = normalize(search);
    return normalize(`${product.name} ${product.description ?? ""}`).includes(needle);
}

/**
 * Días que alcanza el stock al ritmo de los últimos 30 días.
 * null si no hubo pedidos (no hay ritmo para estimar).
 */
export function coverageDays(product: Pick<Product, "stock" | "unitsLast30d">) {
    if (product.unitsLast30d <= 0) return null;
    return Math.floor(product.stock / (product.unitsLast30d / 30));
}

/**
 * Lee una cantidad entera: "120", "1.200" y "1200" son válidos.
 * null si no es un entero no negativo.
 */
export function parseQuantity(raw: FormDataEntryValue | null): number | null {
    if (typeof raw !== "string") return null;
    const value = raw.trim().replace(/[\s.]/g, "");
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

export function isMovementType(value: string): value is MovementType {
    return (MOVEMENT_TYPES as readonly string[]).includes(value);
}

export function isManualMovementType(value: string): value is ManualMovementType {
    return (MANUAL_MOVEMENT_TYPES as readonly string[]).includes(value);
}

export function movementTypeLabel(type: string) {
    return isMovementType(type) ? MOVEMENT_TYPE_LABELS[type] : type;
}

// Stock que quedaría después de un movimiento manual
export function stockAfterMovement(current: number, type: ManualMovementType, quantity: number) {
    if (type === "ingreso") return current + quantity;
    if (type === "egreso") return current - quantity;
    return quantity;
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

// "2026-11-09T17:35:00Z" -> "09/11/2026, 14:35" (hora de Argentina)
export function formatDateTimeAR(value: string) {
    return dateTimeFormatter.format(new Date(value));
}

// "+12", "−5" (el signo menos tipográfico se lee mejor en tablas)
export function formatSignedQuantity(value: number) {
    const formatted = new Intl.NumberFormat("es-AR").format(Math.abs(value));
    return `${value > 0 ? "+" : "−"}${formatted}`;
}

export function formatUnits(value: number) {
    const formatted = new Intl.NumberFormat("es-AR").format(value);
    return `${formatted} ${value === 1 ? "unidad" : "unidades"}`;
}

// Variación porcentual de un precio: "+12,5 %" / "−3 %"
export function formatPriceChangePct(price: number, previous: number | null) {
    if (previous == null || previous <= 0) return null;
    const pct = ((price - previous) / previous) * 100;
    const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(Math.abs(pct));
    if (formatted === "0") return "0 %";
    return `${pct > 0 ? "+" : "−"}${formatted} %`;
}

// Precio con un aumento porcentual, redondeado a $10
export function applyIncrease(price: number, pct: number) {
    return Math.max(0, Math.round((price * (1 + pct / 100)) / 10) * 10);
}
