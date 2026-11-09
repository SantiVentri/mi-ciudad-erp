import "server-only";
import { cache } from "react";
import { getServerClient } from "@/utils/supabase/getServerClient";
import { getCurrentUser } from "@/utils/auth/getCurrentUser";
import { assertNoSupabaseError } from "@/utils/supabase/assertNoError";
import { todayAR } from "@/utils/dates/argentina";
import { dayKey } from "@/modules/orders/orders.utils";
import { nextDayKey } from "@/modules/routes/routes.utils";
import { COSTS_CHART_DAYS, COSTS_METRICS_WINDOW_DAYS } from "@/modules/costs/costs.constants";
import { fullName, isExpenseType } from "@/modules/costs/costs.utils";
import type {
    CostsMetricsData,
    DbClient,
    DurationVarianceMetric,
    EmployeeOption,
    FuelPrice,
    RouteCostDetail,
    RouteExpense,
    Salary,
} from "@/modules/costs/costs.types";

// Sueldos y costos laborales: solo para admin. RLS también lo impide, pero se corta
// antes para no depender solo de la base.
async function getAdminClient() {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return null;
    return getServerClient();
}

function shiftDays(base: Date, days: number) {
    const date = new Date(base);
    date.setDate(date.getDate() + days);
    return date;
}

type ExpenseQueryRow = {
    id: string;
    route_id: string;
    type: string;
    amount: number;
    notes: string | null;
    created_at: string;
    author: { first_name: string | null; last_name: string | null } | null;
};

function toRouteExpense(row: ExpenseQueryRow): RouteExpense {
    return {
        id: row.id,
        type: isExpenseType(row.type) ? row.type : "other",
        amount: Number(row.amount),
        notes: row.notes,
        createdAt: row.created_at,
        authorName: row.author ? fullName(row.author, "") || null : null,
    };
}

const EXPENSE_SELECT = `
    id, route_id, type, amount, notes, created_at,
    author:profiles!route_expenses_created_by_fkey ( first_name, last_name )
`;

export const getFuelPrices = cache(async (): Promise<FuelPrice[] | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("fuel_prices")
        .select("id, price_per_liter, valid_from, valid_to")
        .order("valid_from", { ascending: false })
        .limit(100);

    assertNoSupabaseError(error, "Error trayendo los precios de combustible");

    return (data ?? []).map((row) => ({
        id: row.id,
        pricePerLiter: Number(row.price_per_liter),
        validFrom: row.valid_from,
        validTo: row.valid_to,
    }));
});

export const getSalaries = cache(async (): Promise<Salary[] | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("salaries")
        .select(
            `
                id, profile_id, monthly_salary, social_charges_pct, monthly_hours,
                valid_from, valid_to,
                profile:profiles ( first_name, last_name, email )
            `,
        )
        .order("valid_from", { ascending: false })
        .limit(500);

    assertNoSupabaseError(error, "Error trayendo los sueldos");

    return (data ?? []).map((row) => ({
        id: row.id,
        profileId: row.profile_id,
        employeeName: fullName(row.profile, "Empleado eliminado"),
        monthlySalary: Number(row.monthly_salary),
        socialChargesPct: Number(row.social_charges_pct),
        monthlyHours: Number(row.monthly_hours),
        validFrom: row.valid_from,
        validTo: row.valid_to,
    }));
});

// Conductores activos, para elegir a quién cargarle un sueldo
export const getSalaryEmployeeOptions = cache(async (): Promise<EmployeeOption[] | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase.rpc("get_drivers");

    assertNoSupabaseError(error, "Error trayendo los conductores");

    return (data ?? [])
        .filter((driver) => driver.is_active !== false)
        .map((driver) => ({ id: driver.id, label: fullName(driver, "Sin nombre") }))
        .sort((a, b) => a.label.localeCompare(b.label));
});

// Patentes de los vehículos activos sin rendimiento: sin ese dato no se calcula el costo
export const getVehiclesWithoutYield = cache(async (): Promise<string[] | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("vehicles")
        .select("patent")
        .neq("is_active", false)
        .is("km_per_liter", null)
        .order("patent", { ascending: true });

    assertNoSupabaseError(error, "Error trayendo los vehículos sin rendimiento");

    return (data ?? []).map((row) => row.patent);
});

/**
 * Costo estimado, tiempos y gastos de las rutas de un rango de fechas, por id de ruta.
 * Mismo filtro de fechas que getAdminRoutes. Solo admin: incluye el costo laboral,
 * del que se pueden deducir sueldos.
 */
export const getRouteCostDetails = cache(
    async (startDate: string, endDate: string): Promise<Record<string, RouteCostDetail> | null> => {
        const supabase = await getAdminClient();
        if (!supabase) return null;

        const { data: summaries, error } = await supabase
            .from("route_cost_summary")
            .select("*")
            .gte("route_date", startDate)
            .lte("route_date", endDate);

        assertNoSupabaseError(error, "Error trayendo los costos de las rutas");

        const routeIds = (summaries ?? [])
            .map((row) => row.route_id)
            .filter((id): id is string => id != null);

        const expensesByRoute = new Map<string, RouteExpense[]>();
        if (routeIds.length > 0) {
            const { data: expenses, error: expensesError } = await supabase
                .from("route_expenses")
                .select(EXPENSE_SELECT)
                .in("route_id", routeIds)
                .order("created_at", { ascending: true });

            assertNoSupabaseError(expensesError, "Error trayendo los gastos de las rutas");

            for (const row of (expenses ?? []) as ExpenseQueryRow[]) {
                const list = expensesByRoute.get(row.route_id) ?? [];
                list.push(toRouteExpense(row));
                expensesByRoute.set(row.route_id, list);
            }
        }

        const details: Record<string, RouteCostDetail> = {};
        for (const row of summaries ?? []) {
            if (!row.route_id) continue;
            details[row.route_id] = {
                estimatedDistanceKm: toNumberOrNull(row.estimated_distance_km),
                estimatedDurationMin: toNumberOrNull(row.estimated_duration_min),
                actualDurationMin: toNumberOrNull(row.actual_duration_min),
                durationVarianceMin: toNumberOrNull(row.duration_variance_min),
                estimatedFuelCost: toNumberOrNull(row.estimated_fuel_cost),
                estimatedLaborCost: toNumberOrNull(row.estimated_labor_cost),
                totalExpenses: Number(row.total_expenses ?? 0),
                estimatedCostPlusExpenses: Number(row.estimated_cost_plus_expenses ?? 0),
                expenses: expensesByRoute.get(row.route_id) ?? [],
            };
        }

        return details;
    },
);

function toNumberOrNull(value: number | string | null | undefined) {
    return value == null ? null : Number(value);
}

type DeliveredStopRow = {
    id: string;
    order: { order_details: { quantity: number; unit_price: number | null }[] } | null;
};

/**
 * Paradas entregadas de las rutas dadas y lo que se vendió en ellas
 * (cantidad × precio guardado en cada renglón). Pagina de a 1000 filas.
 */
async function getRouteDeliveries(supabase: DbClient, routeIds: string[]) {
    const result = { count: 0, sales: 0, unpricedLines: 0 };
    if (routeIds.length === 0) return result;

    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from("stops")
            .select("id, order:orders ( order_details ( quantity, unit_price ) )")
            .in("route_id", routeIds)
            .eq("state", "Completada")
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);

        assertNoSupabaseError(error, "Error trayendo las entregas de las rutas");

        for (const stop of (data ?? []) as DeliveredStopRow[]) {
            result.count += 1;
            for (const line of stop.order?.order_details ?? []) {
                if (line.unit_price == null) result.unpricedLines += 1;
                else result.sales += Number(line.quantity) * Number(line.unit_price);
            }
        }

        if (!data || data.length < PAGE) break;
    }

    return result;
}

export const getCostsMetrics = cache(async (): Promise<CostsMetricsData | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const today = todayAR();
    const windowStart = `${dayKey(shiftDays(today, -(COSTS_METRICS_WINDOW_DAYS - 1)))}T00:00:00Z`;
    const windowEnd = `${nextDayKey(dayKey(today))}T00:00:00Z`;

    const todayKey = dayKey(today);
    const windowStartKey = windowStart.slice(0, 10);

    // Precios que estuvieron vigentes en algún día de la ventana: sirven para el precio
    // de hoy y para pasar el costo de combustible de cada ruta a litros
    const [fuelRes, vehiclesRes, summaryRes] = await Promise.all([
        supabase
            .from("fuel_prices")
            .select("price_per_liter, valid_from, valid_to")
            .lte("valid_from", todayKey)
            .or(`valid_to.is.null,valid_to.gte.${windowStartKey}`)
            .order("valid_from", { ascending: false }),
        supabase
            .from("vehicles")
            .select("km_per_liter")
            .neq("is_active", false)
            .not("km_per_liter", "is", null),
        supabase
            .from("route_cost_summary")
            .select(
                "route_id, route_date, state, estimated_fuel_cost, estimated_labor_cost, total_expenses",
            )
            .gte("route_date", windowStart)
            .lt("route_date", windowEnd),
    ]);

    assertNoSupabaseError(fuelRes.error, "Error trayendo el precio de combustible vigente");
    assertNoSupabaseError(vehiclesRes.error, "Error trayendo el rendimiento de la flota");
    assertNoSupabaseError(summaryRes.error, "Error trayendo las métricas de costos");

    const fuelPrices = (fuelRes.data ?? []).map((row) => ({
        pricePerLiter: Number(row.price_per_liter),
        validFrom: row.valid_from,
        validTo: row.valid_to,
    }));
    // Precio por litro vigente en una fecha "YYYY-MM-DD" (la lista viene de más nuevo a más viejo)
    const priceOn = (day: string) =>
        fuelPrices.find(
            (price) => price.validFrom <= day && (price.validTo === null || price.validTo >= day),
        ) ?? null;

    // Vigente hoy (no el último cargado: puede haber uno programado para más adelante)
    const todayPrice = priceOn(todayKey);
    const currentFuelPrice = todayPrice
        ? { pricePerLiter: todayPrice.pricePerLiter, validFrom: todayPrice.validFrom }
        : null;

    const yields = (vehiclesRes.data ?? []).map((row) => Number(row.km_per_liter));
    const avgKmPerLiter =
        yields.length > 0 ? yields.reduce((sum, value) => sum + value, 0) / yields.length : null;
    const fuelCostPerKm =
        currentFuelPrice && avgKmPerLiter ? currentFuelPrice.pricePerLiter / avgKmPerLiter : null;

    const rows = (summaryRes.data ?? []).filter((row) => row.state !== "Cancelada");

    // Costo por entrega y sobre ventas: solo rutas completadas con costo calculado
    // (una ruta de hoy sin terminar no tiene entregas todavía y bajaría el promedio)
    const routeCost = (row: (typeof rows)[number]) =>
        Number(row.estimated_fuel_cost) + Number(row.estimated_labor_cost) + Number(row.total_expenses ?? 0);
    const completedRows = rows.filter(
        (row) =>
            row.state === "Completada" &&
            row.route_id != null &&
            row.estimated_fuel_cost != null &&
            row.estimated_labor_cost != null,
    );
    const completedCost = completedRows.reduce((sum, row) => sum + routeCost(row), 0);
    const deliveries = await getRouteDeliveries(
        supabase,
        completedRows.map((row) => row.route_id as string),
    );

    const totalExpenses = rows.reduce((sum, row) => sum + Number(row.total_expenses ?? 0), 0);
    const routesWithExpenses = rows.filter((row) => Number(row.total_expenses ?? 0) > 0).length;

    const costByDay = new Map<string, number>();
    for (const row of rows) {
        if (!row.route_date) continue;
        const key = row.route_date.slice(0, 10);
        const cost =
            Number(row.estimated_fuel_cost ?? 0) +
            Number(row.estimated_labor_cost ?? 0) +
            Number(row.total_expenses ?? 0);
        costByDay.set(key, (costByDay.get(key) ?? 0) + cost);
    }

    const estimatedCostPerDay: { label: string; value: number }[] = [];
    for (let i = COSTS_CHART_DAYS - 1; i >= 0; i--) {
        const day = shiftDays(today, -i);
        estimatedCostPerDay.push({
            label: `${day.getDate()}/${day.getMonth() + 1}`,
            value: Math.round(costByDay.get(dayKey(day)) ?? 0),
        });
    }

    return {
        currentFuelPrice,
        fuelCostPerKm,
        vehiclesWithYield: yields.length,
        totalExpenses,
        routesWithExpenses,
        completedRoutes: completedRows.length,
        avgCostPerRoute: completedRows.length > 0 ? completedCost / completedRows.length : null,
        deliveries: deliveries.count,
        costPerDelivery: deliveries.count > 0 ? completedCost / deliveries.count : null,
        deliveredSales: deliveries.sales,
        unpricedLines: deliveries.unpricedLines,
        // Con renglones sin precio la proporción saldría inflada: no se muestra
        logisticsCostPct:
            deliveries.sales > 0 && deliveries.unpricedLines === 0
                ? (completedCost / deliveries.sales) * 100
                : null,
        estimatedCostPerDay,
    };
});

/**
 * Desvío promedio entre la duración real y la estimada de las rutas finalizadas en
 * los últimos 30 días (se muestra en las métricas de Rutas). Solo admin: sale de
 * route_cost_summary.
 */
export const getDurationVariance = cache(async (): Promise<DurationVarianceMetric | null> => {
    const supabase = await getAdminClient();
    if (!supabase) return null;

    const today = todayAR();
    const windowStart = `${dayKey(shiftDays(today, -(COSTS_METRICS_WINDOW_DAYS - 1)))}T00:00:00Z`;
    const windowEnd = `${nextDayKey(dayKey(today))}T00:00:00Z`;

    const { data, error } = await supabase
        .from("route_cost_summary")
        .select("state, duration_variance_min")
        .gte("route_date", windowStart)
        .lt("route_date", windowEnd)
        .not("duration_variance_min", "is", null);

    assertNoSupabaseError(error, "Error trayendo el desvío de duración de las rutas");

    const variances = (data ?? [])
        .filter((row) => row.state !== "Cancelada")
        .map((row) => Number(row.duration_variance_min));

    return {
        avgVarianceMin:
            variances.length > 0
                ? variances.reduce((sum, value) => sum + value, 0) / variances.length
                : null,
        routesMeasured: variances.length,
    };
});

/**
 * Gastos de una ruta. Apto para el conductor: no trae sueldos ni costos estimados.
 * RLS limita al conductor a las rutas donde es chofer o acompañante.
 */
export const getRouteExpenses = cache(async (routeId: string): Promise<RouteExpense[]> => {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "driver")) return [];

    const supabase = await getServerClient();

    const { data, error } = await supabase
        .from("route_expenses")
        .select(EXPENSE_SELECT)
        .eq("route_id", routeId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error trayendo los gastos de la ruta:", error);
        return [];
    }

    return ((data ?? []) as ExpenseQueryRow[]).map(toRouteExpense);
});
