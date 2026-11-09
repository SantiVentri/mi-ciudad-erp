export const COSTS_PATH = "/admin/costs";

// Minutos de descarga por parada que se suman al tiempo de manejo de OpenRouteService
export const STOP_SERVICE_MINUTES = 10;

// Horas pagas por mes que se proponen al cargar un sueldo (44 h × 4 semanas)
export const DEFAULT_MONTHLY_HOURS = 176;

// Ventana de las métricas
export const COSTS_METRICS_WINDOW_DAYS = 30;
export const COSTS_CHART_DAYS = 10;

// Topes de validación (evitan errores de tipeo como un cero de más)
export const MAX_FUEL_PRICE = 100_000;
export const MAX_MONTHLY_SALARY = 100_000_000;
export const MAX_SOCIAL_CHARGES_PCT = 200;
export const MAX_MONTHLY_HOURS = 744;
export const MAX_EXPENSE_AMOUNT = 10_000_000;
export const MAX_EXPENSE_NOTES_LENGTH = 300;

// Valores de route_expenses.type (CHECK de la base)
export const EXPENSE_TYPES = ["toll", "parking", "fine", "other"] as const;

export const EXPENSE_TYPE_LABELS: Record<(typeof EXPENSE_TYPES)[number], string> = {
    toll: "Peaje",
    parking: "Estacionamiento",
    fine: "Multa",
    other: "Otro",
};

export const COSTS_TABS = [
    { id: "combustible", label: "Combustible" },
    { id: "sueldos", label: "Sueldos" },
] as const;
