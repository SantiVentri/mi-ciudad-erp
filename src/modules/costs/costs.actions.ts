"use server";

import { revalidatePath } from "next/cache";
import requireAdmin from "@/utils/auth/requireAdmin";
import { getCurrentUser } from "@/utils/auth/getCurrentUser";
import { getServerClient } from "@/utils/supabase/getServerClient";
import { todayKeyAR } from "@/utils/dates/argentina";
import {
    COSTS_PATH,
    MAX_EXPENSE_AMOUNT,
    MAX_EXPENSE_NOTES_LENGTH,
    MAX_FUEL_PRICE,
    MAX_MONTHLY_HOURS,
    MAX_MONTHLY_SALARY,
    MAX_SOCIAL_CHARGES_PCT,
} from "@/modules/costs/costs.constants";
import {
    formatDayKey,
    isDayKey,
    isExpenseType,
    isUuid,
    parseDecimal,
} from "@/modules/costs/costs.utils";
import { refreshRouteEstimate, saveRouteEstimateWithClient } from "@/modules/costs/costs.estimate";
import type { ActionResult } from "@/modules/costs/costs.types";

// Todas las funciones exportadas de este archivo se pueden invocar con un POST
// directo: cada una valida el rol y la entrada en el servidor.

function readDate(formData: FormData, field: string) {
    const value = String(formData.get(field) ?? "").trim();
    return value || todayKeyAR();
}

// --- Combustible ---

export async function createFuelPrice(formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para cargar precios de combustible." };
    }

    const price = parseDecimal(formData.get("pricePerLiter"));
    if (price == null || price <= 0) {
        return { error: "Ingresá el precio por litro como un número mayor a cero." };
    }
    if (price > MAX_FUEL_PRICE) {
        return { error: "El precio por litro parece demasiado alto. Revisá que no sobre un cero." };
    }

    const validFrom = readDate(formData, "validFrom");
    if (!isDayKey(validFrom)) {
        return { error: "La fecha de vigencia no es válida." };
    }

    // El trigger cierra el último precio cargado; uno anterior a él chocaría con la vigencia
    const { data: current, error: currentError } = await supabase
        .from("fuel_prices")
        .select("valid_from")
        .is("valid_to", null)
        .maybeSingle();

    if (currentError) {
        return { error: "No se pudo leer el precio vigente. Probá de nuevo." };
    }
    if (current && validFrom <= current.valid_from) {
        return {
            error: `El último precio cargado empieza el ${formatDayKey(current.valid_from)}. El nuevo tiene que empezar después de esa fecha.`,
        };
    }

    const { error } = await supabase
        .from("fuel_prices")
        .insert({ price_per_liter: price, valid_from: validFrom });

    if (error) {
        return {
            error:
                error.code === "23505"
                    ? "Ya hay un precio vigente que empieza en esa fecha o después. Elegí una fecha posterior."
                    : "No se pudo guardar el precio: " + error.message,
        };
    }

    revalidatePath(COSTS_PATH);
    return { ok: true };
}

// --- Sueldos ---

export async function createSalary(formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para cargar sueldos." };
    }

    const profileId = String(formData.get("profileId") ?? "").trim();
    if (!isUuid(profileId)) {
        return { error: "Elegí el empleado." };
    }

    const monthlySalary = parseDecimal(formData.get("monthlySalary"));
    if (monthlySalary == null || monthlySalary <= 0) {
        return { error: "Ingresá el sueldo mensual como un número mayor a cero." };
    }
    if (monthlySalary > MAX_MONTHLY_SALARY) {
        return { error: "El sueldo parece demasiado alto. Revisá que no sobre un cero." };
    }

    const socialChargesPct = parseDecimal(formData.get("socialChargesPct")) ?? 0;
    if (socialChargesPct < 0 || socialChargesPct > MAX_SOCIAL_CHARGES_PCT) {
        return { error: `Las cargas sociales tienen que estar entre 0 y ${MAX_SOCIAL_CHARGES_PCT} %.` };
    }

    const monthlyHours = parseDecimal(formData.get("monthlyHours"));
    if (monthlyHours == null || monthlyHours <= 0 || monthlyHours > MAX_MONTHLY_HOURS) {
        return { error: `Ingresá las horas mensuales pagas (entre 1 y ${MAX_MONTHLY_HOURS}).` };
    }

    const validFrom = readDate(formData, "validFrom");
    if (!isDayKey(validFrom)) {
        return { error: "La fecha de vigencia no es válida." };
    }

    const { data: current, error: currentError } = await supabase
        .from("salaries")
        .select("valid_from")
        .eq("profile_id", profileId)
        .is("valid_to", null)
        .maybeSingle();

    if (currentError) {
        return { error: "No se pudo leer el sueldo vigente. Probá de nuevo." };
    }
    if (current && validFrom <= current.valid_from) {
        return {
            error: `El último sueldo cargado de este empleado empieza el ${formatDayKey(current.valid_from)}. El nuevo tiene que empezar después de esa fecha.`,
        };
    }

    const { error } = await supabase.from("salaries").insert({
        profile_id: profileId,
        monthly_salary: monthlySalary,
        social_charges_pct: socialChargesPct,
        monthly_hours: monthlyHours,
        valid_from: validFrom,
    });

    if (error) {
        return {
            error:
                error.code === "23505"
                    ? "Este empleado ya tiene un sueldo vigente que empieza en esa fecha o después. Elegí una fecha posterior."
                    : error.code === "23503"
                      ? "El empleado elegido no existe. Recargá la página y elegilo de nuevo."
                      : "No se pudo guardar el sueldo: " + error.message,
        };
    }

    revalidatePath(COSTS_PATH);
    return { ok: true };
}

// --- Estimación por ruta ---

export async function saveRouteEstimate(
    routeId: string,
    distanceKm: number,
    durationMin: number,
): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para estimar costos." };
    }

    if (!isUuid(routeId)) {
        return { error: "La ruta no es válida." };
    }
    if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(durationMin) || durationMin < 0) {
        return { error: "La distancia y la duración tienen que ser números positivos." };
    }

    const result = await saveRouteEstimateWithClient(supabase, routeId, distanceKm, durationMin);

    revalidatePath(COSTS_PATH);
    revalidatePath("/admin/routes");
    return result;
}

// Vuelve a calcular km, minutos y costo (por ejemplo, después de cargar un sueldo faltante)
export async function recalculateRouteCost(routeId: string): Promise<ActionResult> {
    const supabase = await requireAdmin();
    if (!supabase) {
        return { error: "No tenés permisos para estimar costos." };
    }

    if (!isUuid(routeId)) {
        return { error: "La ruta no es válida." };
    }

    const result = await refreshRouteEstimate(supabase, routeId);

    revalidatePath(COSTS_PATH);
    revalidatePath("/admin/routes");
    return result;
}

// --- Gastos del conductor ---

export async function addRouteExpense(formData: FormData): Promise<ActionResult> {
    const user = await getCurrentUser();
    if (!user || (user.role !== "driver" && user.role !== "admin")) {
        return { error: "Iniciá sesión para cargar gastos." };
    }

    const routeId = String(formData.get("routeId") ?? "").trim();
    if (!isUuid(routeId)) {
        return { error: "La ruta no es válida." };
    }

    const type = String(formData.get("type") ?? "");
    if (!isExpenseType(type)) {
        return { error: "Elegí el tipo de gasto." };
    }

    const amount = parseDecimal(formData.get("amount"));
    if (amount == null || amount <= 0) {
        return { error: "Ingresá el monto como un número mayor a cero." };
    }
    if (amount > MAX_EXPENSE_AMOUNT) {
        return { error: "El monto parece demasiado alto. Revisá que no sobre un cero." };
    }

    const notes = String(formData.get("notes") ?? "").trim();
    if (notes.length > MAX_EXPENSE_NOTES_LENGTH) {
        return { error: `La nota puede tener hasta ${MAX_EXPENSE_NOTES_LENGTH} caracteres.` };
    }
    if (type === "other" && !notes) {
        return { error: "Contá en la nota qué fue el gasto." };
    }

    const supabase = await getServerClient();

    // RLS solo devuelve la ruta si es del conductor (o si es admin)
    const { data: route, error: routeError } = await supabase
        .from("routes")
        .select("id, state, route_number")
        .eq("id", routeId)
        .maybeSingle();

    if (routeError) {
        return { error: "No se pudo leer la ruta. Probá de nuevo." };
    }
    if (!route) {
        return { error: "No encontramos la ruta o no estás asignado a ella." };
    }
    if (route.state !== "En curso") {
        return {
            error: `Solo podés cargar gastos mientras la ruta está en curso (la ruta #${route.route_number} está ${String(route.state ?? "pendiente").toLowerCase()}).`,
        };
    }

    const { error } = await supabase.from("route_expenses").insert({
        route_id: routeId,
        type,
        amount,
        notes: notes || null,
        created_by: user.id,
    });

    if (error) {
        return {
            error:
                error.code === "42501"
                    ? "No se pudo cargar el gasto: la ruta ya no está en curso o no estás asignado a ella."
                    : "No se pudo cargar el gasto: " + error.message,
        };
    }

    revalidatePath(`/driver/routes/${routeId}`);
    revalidatePath(COSTS_PATH);
    return { ok: true };
}
