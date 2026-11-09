import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS } from "@/modules/costs/costs.constants";
import type { ExpenseType } from "@/modules/costs/costs.types";

const EMPTY = "—";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

export function formatCurrency(value: number | null | undefined) {
    return value == null ? EMPTY : currencyFormatter.format(value);
}

export function formatNumber(value: number | null | undefined) {
    return value == null ? EMPTY : numberFormatter.format(value);
}

export function formatKm(value: number | null | undefined) {
    return value == null ? EMPTY : `${numberFormatter.format(value)} km`;
}

// 135 -> "2 h 15 min"
export function formatMinutes(value: number | null | undefined) {
    if (value == null) return EMPTY;
    const total = Math.round(Math.abs(value));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours === 0) return `${minutes} min`;
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

// Desvío real - estimado: "+15 min" (tardó más) / "−10 min" (tardó menos)
export function formatVariance(value: number | null | undefined) {
    if (value == null) return EMPTY;
    if (Math.round(value) === 0) return "0 min";
    return `${value > 0 ? "+" : "−"}${formatMinutes(value)}`;
}

/**
 * "2026-11-09" o "2026-11-09T00:00:00+00:00" -> "09/11/2026".
 * Toma la parte de la fecha tal cual (las rutas se guardan a medianoche UTC
 * y las vigencias son date), así no se corre un día por la zona horaria.
 */
export function formatDayKey(value: string | null | undefined) {
    if (!value) return EMPTY;
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
}

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
});

export function formatTimeAR(value: string) {
    return timeFormatter.format(new Date(value));
}

export function isDayKey(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Lee un número escrito a la argentina o con punto decimal:
 * "1400", "1400,50", "1.400,50" y "1400.50" son válidos. null si no es un número.
 */
export function parseDecimal(raw: FormDataEntryValue | null): number | null {
    if (typeof raw !== "string") return null;
    let value = raw.trim().replace(/\s/g, "").replace(/^\$/, "");
    if (!value) return null;
    if (value.includes(",")) {
        value = value.replace(/\./g, "").replace(",", ".");
    }
    if (!/^\d+(\.\d+)?$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function isExpenseType(value: string): value is ExpenseType {
    return (EXPENSE_TYPES as readonly string[]).includes(value);
}

export function expenseTypeLabel(type: string) {
    return isExpenseType(type) ? EXPENSE_TYPE_LABELS[type] : type;
}

/**
 * Estado de un precio o sueldo con vigencia (fechas "YYYY-MM-DD", comparables como texto).
 * Uno cargado con fecha futura queda "programado": el anterior sigue vigente hasta entonces.
 */
export function getValidityStatus(validFrom: string, validTo: string | null, today: string) {
    if (validFrom > today) return "scheduled" as const;
    if (validTo !== null && validTo < today) return "past" as const;
    return "current" as const;
}

// Costo de una hora de trabajo con cargas sociales
export function hourlyCost(monthlySalary: number, socialChargesPct: number, monthlyHours: number) {
    if (monthlyHours <= 0) return 0;
    return (monthlySalary * (1 + socialChargesPct / 100)) / monthlyHours;
}

export function fullName(
    profile: { first_name: string | null; last_name: string | null; email?: string | null } | null,
    fallback: string,
) {
    if (!profile) return fallback;
    const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    return name || profile.email || fallback;
}
