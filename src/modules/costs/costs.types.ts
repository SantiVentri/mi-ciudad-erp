import type { Database } from "@/utils/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { COSTS_TABS, EXPENSE_TYPES } from "@/modules/costs/costs.constants";

export type DbClient = SupabaseClient<Database>;

export type FuelPriceRow = Database["public"]["Tables"]["fuel_prices"]["Row"];
export type SalaryRow = Database["public"]["Tables"]["salaries"]["Row"];
export type RouteExpenseRow = Database["public"]["Tables"]["route_expenses"]["Row"];

export type ExpenseType = (typeof EXPENSE_TYPES)[number];
export type CostsTabId = (typeof COSTS_TABS)[number]["id"];

export type ActionResult = { ok: true } | { error: string };

// Gasto tal como lo ve el conductor (y el admin en el detalle de la ruta)
export type RouteExpense = {
    id: string;
    type: ExpenseType;
    amount: number;
    notes: string | null;
    createdAt: string;
    authorName: string | null;
};

export type FuelPrice = {
    id: string;
    pricePerLiter: number;
    validFrom: string;
    validTo: string | null;
};

export type Salary = {
    id: string;
    profileId: string;
    employeeName: string;
    monthlySalary: number;
    socialChargesPct: number;
    monthlyHours: number;
    validFrom: string;
    validTo: string | null;
};

export type EmployeeOption = {
    id: string;
    label: string;
};

// Costo de una ruta para el detalle en el módulo Rutas (solo admin)
export type RouteCostDetail = {
    estimatedDistanceKm: number | null;
    estimatedDurationMin: number | null;
    actualDurationMin: number | null;
    durationVarianceMin: number | null;
    estimatedFuelCost: number | null;
    estimatedLaborCost: number | null;
    totalExpenses: number;
    estimatedCostPlusExpenses: number;
    expenses: RouteExpense[];
};

export type CostsMetricsData = {
    currentFuelPrice: { pricePerLiter: number; validFrom: string } | null;
    fuelCostPerKm: number | null;
    vehiclesWithYield: number;
    avgDurationVarianceMin: number | null;
    finishedRoutesMeasured: number;
    totalExpenses: number;
    routesWithExpenses: number;
    // Promedios por ruta (rutas no canceladas con costo calculado, últimos 30 días)
    avgCostPerRoute: number | null;
    avgFuelCostPerRoute: number | null;
    avgLitersPerRoute: number | null;
    avgKmPerRoute: number | null;
    routesWithCost: number;
    estimatedCostPerDay: { label: string; value: number }[];
};
