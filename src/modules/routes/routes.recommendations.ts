// Recomendaciones para asignar conductor, acompañante y vehículo a una ruta.
// Son funciones puras: el modal las recalcula en el cliente cada vez que cambia
// la selección (la sugerencia de acompañante depende del conductor elegido, etc.).

import type { SelectOption } from "@/modules/routes/routes.types";

// Carga de trabajo: rutas entre 7 días antes y 7 días después de la fecha de la ruta
export const LOAD_WINDOW_DAYS = 7;
// Hasta dónde se mira hacia atrás para "días sin rutas", parejas y último vehículo
export const LOOKBACK_DAYS = 30;

// Más de 1,5 veces el promedio del equipo cuenta como "muy usado"
const OVERUSED_RATIO = 1.5;
const MIN_ROUTES_OVERUSED = 3;
const MAX_TAGS = 3;
// Quien ya tiene una ruta ese día va al final de la lista (se puede elegir igual)
const SAME_DAY_PENALTY = 100;

// Ruta ya existente, reducida a lo que hace falta para las recomendaciones
export type AssignmentRoute = {
    routeNumber: number;
    date: string; // "YYYY-MM-DD"
    driverId: string;
    coDriverId: string | null;
    vehicleId: string;
    km: number | null;
    minutes: number | null;
};

export type AssignmentData = {
    date: string;
    routes: AssignmentRoute[];
    kmPerLiter: Record<string, number | null>;
};

export type TagTone = "positive" | "neutral" | "warning";

export type RecommendationTag = {
    label: string;
    tone: TagTone;
};

export type Recommendation = {
    id: string;
    label: string;
    suggested: boolean;
    // "3 rutas · 210 km · 9 h"; vacío si no hay datos
    summary: string;
    tags: RecommendationTag[];
};

type Usage = {
    routes: number;
    km: number;
    minutes: number;
    asDriver: number;
    asCoDriver: number;
    // Días entre la última ruta anterior y la fecha de la ruta; null si no hubo en LOOKBACK_DAYS
    lastDaysAgo: number | null;
    // Números de las rutas que ya tiene ese mismo día
    sameDay: number[];
};

type Ranked = Recommendation & { score: number; blocked: boolean };

// Días de "from" a "to" (positivo si "to" es posterior)
function dayDiff(from: string, to: string) {
    const [y1, m1, d1] = from.split("-").map(Number);
    const [y2, m2, d2] = to.split("-").map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

function getUsage(
    data: AssignmentData,
    matches: (route: AssignmentRoute) => "driver" | "coDriver" | "vehicle" | null,
): Usage {
    const usage: Usage = {
        routes: 0,
        km: 0,
        minutes: 0,
        asDriver: 0,
        asCoDriver: 0,
        lastDaysAgo: null,
        sameDay: [],
    };

    for (const route of data.routes) {
        const role = matches(route);
        if (!role) continue;

        const offset = dayDiff(data.date, route.date);

        if (offset === 0) usage.sameDay.push(route.routeNumber);
        if (offset < 0 && (usage.lastDaysAgo === null || -offset < usage.lastDaysAgo)) {
            usage.lastDaysAgo = -offset;
        }

        if (Math.abs(offset) <= LOAD_WINDOW_DAYS) {
            usage.routes += 1;
            usage.km += route.km ?? 0;
            usage.minutes += route.minutes ?? 0;
            if (role === "driver") usage.asDriver += 1;
            if (role === "coDriver") usage.asCoDriver += 1;
        }
    }

    return usage;
}

function average(values: number[]) {
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

// Carga de cada uno respecto del promedio del grupo (1 = promedio), mezclando rutas, km y horas
function relativeLoads(usages: Usage[], metrics: ((usage: Usage) => number)[]) {
    const averages = metrics.map((metric) => average(usages.map(metric)));

    return usages.map((usage) => {
        const ratios = metrics.flatMap((metric, i) =>
            averages[i] > 0 ? [metric(usage) / averages[i]] : [],
        );
        return ratios.length > 0 ? average(ratios) : 0;
    });
}

function formatNumber(value: number, decimals = 1) {
    return value.toLocaleString("es-AR", { maximumFractionDigits: decimals });
}

function formatDuration(minutes: number) {
    return minutes < 60 ? `${Math.round(minutes)} min` : `${formatNumber(minutes / 60)} h`;
}

function usageSummary(usage: Usage, withHours: boolean) {
    if (usage.routes === 0) return `Sin rutas en ±${LOAD_WINDOW_DAYS} días`;

    const parts = [`${usage.routes} ${usage.routes === 1 ? "ruta" : "rutas"}`];
    if (usage.km > 0) parts.push(`${formatNumber(usage.km, 0)} km`);
    if (withHours && usage.minutes > 0) parts.push(formatDuration(usage.minutes));
    return parts.join(" · ");
}

function isOverused(load: number, usage: Usage) {
    // Con equipos chicos el promedio es bajo: con menos de 3 rutas nadie es "muy usado"
    return load >= OVERUSED_RATIO && usage.routes >= MIN_ROUTES_OVERUSED;
}

function isLeastLoaded(load: number, loads: number[]) {
    const min = Math.min(...loads);
    const max = Math.max(...loads);
    return loads.length > 1 && max > min && load === min;
}

function sameDayTag(sameDay: number[], subject: "person" | "vehicle"): RecommendationTag {
    const numbers = sameDay.map((n) => `#${n}`).join(", ");
    return {
        label:
            subject === "person"
                ? `Ya tiene la ruta ${numbers} ese día`
                : `Ya está en la ruta ${numbers} ese día`,
        tone: "warning",
    };
}

function recencyTag(lastDaysAgo: number | null): RecommendationTag | null {
    if (lastDaysAgo === null) {
        return { label: `Más de ${LOOKBACK_DAYS} días sin rutas`, tone: "positive" };
    }
    if (lastDaysAgo >= 3) {
        return { label: `Hace ${lastDaysAgo} días sin rutas`, tone: "positive" };
    }
    if (lastDaysAgo === 1) {
        return { label: "Salió el día anterior", tone: "neutral" };
    }
    return null;
}

// Las advertencias van primero; el resto respeta el orden de prioridad en que se pasan
function pickTags(tags: (RecommendationTag | null)[]) {
    const present = tags.filter((tag): tag is RecommendationTag => tag !== null);
    return [
        ...present.filter((tag) => tag.tone === "warning"),
        ...present.filter((tag) => tag.tone !== "warning"),
    ].slice(0, MAX_TAGS);
}

// Ordena por puntaje (menor = mejor) y marca como sugerido al mejor que no tenga ruta ese día
function finish(ranked: Ranked[]): Recommendation[] {
    const sorted = [...ranked].sort(
        (a, b) => a.score - b.score || a.label.localeCompare(b.label),
    );
    const suggestedId = sorted.find((item) => !item.blocked)?.id;

    return sorted.map((item) => ({
        id: item.id,
        label: item.label,
        suggested: item.id === suggestedId,
        summary: item.summary,
        tags: item.tags,
    }));
}

function plain(options: SelectOption[]): Recommendation[] {
    return options.map((option) => ({
        id: option.id,
        label: option.label,
        suggested: false,
        summary: "",
        tags: [],
    }));
}

/**
 * Conductores o acompañantes ordenados de más a menos recomendable.
 * - Carga: rutas, km y horas en ±7 días comparados con el promedio del equipo.
 * - Prioriza a quien hace más días que no sale.
 * - Rota roles: como conductor conviene quien viene de acompañante, y al revés.
 * - Evita repetir pareja con la persona ya elegida para el otro rol (partnerId).
 */
export function rankPeople(
    options: SelectOption[],
    data: AssignmentData | null,
    role: "driver" | "coDriver",
    partnerId: string,
): Recommendation[] {
    const visible = options.filter((option) => option.id !== partnerId);
    if (!data) return plain(visible);

    // El promedio se calcula con todo el equipo, aunque el compañero no se muestre
    const usages = options.map((option) =>
        getUsage(data, (route) =>
            route.driverId === option.id
                ? "driver"
                : route.coDriverId === option.id
                  ? "coDriver"
                  : null,
        ),
    );
    const loads = relativeLoads(usages, [(u) => u.routes, (u) => u.km, (u) => u.minutes]);

    const ranked = options.flatMap((option, i): Ranked[] => {
        if (option.id === partnerId) return [];

        const usage = usages[i];
        const load = loads[i];
        const overused = isOverused(load, usage);

        // Cuántas veces salieron juntos (en cualquier rol) en todo el período cargado
        const pairCount = partnerId
            ? data.routes.filter(
                  (route) =>
                      (route.driverId === option.id && route.coDriverId === partnerId) ||
                      (route.driverId === partnerId && route.coDriverId === option.id),
              ).length
            : 0;

        // > 0 si viene manejando más de lo que acompaña
        const roleBalance = (usage.asDriver - usage.asCoDriver) / Math.max(usage.routes, 1);
        const rolePenalty = (role === "driver" ? roleBalance : -roleBalance) * 0.3;
        const recencyBonus =
            (Math.min(usage.lastDaysAgo ?? LOOKBACK_DAYS, 14) / 14) * 0.5;
        const blocked = usage.sameDay.length > 0;

        const score =
            load -
            recencyBonus +
            rolePenalty +
            pairCount * 0.25 +
            (blocked ? SAME_DAY_PENALTY : 0);

        const drivesMore = usage.asDriver > usage.asCoDriver;
        const ridesMore = usage.asCoDriver > usage.asDriver;
        const roleTag: RecommendationTag | null =
            role === "driver"
                ? ridesMore
                    ? { label: "Viene de acompañante", tone: "positive" }
                    : drivesMore && usage.asDriver >= 2
                      ? { label: "Viene manejando", tone: "neutral" }
                      : null
                : drivesMore
                  ? { label: "Viene manejando", tone: "positive" }
                  : ridesMore && usage.asCoDriver >= 2
                    ? { label: "Viene de acompañante", tone: "neutral" }
                    : null;

        const pairTag: RecommendationTag | null = !partnerId
            ? null
            : pairCount === 0
              ? { label: "Pareja nueva", tone: "positive" }
              : pairCount >= 2
                ? { label: `Ya salieron juntos ${pairCount} veces`, tone: "warning" }
                : null;

        const tags = pickTags([
            blocked ? sameDayTag(usage.sameDay, "person") : null,
            overused ? { label: `Muy usado: ${usage.routes} rutas`, tone: "warning" } : null,
            recencyTag(usage.lastDaysAgo),
            pairTag,
            isLeastLoaded(load, loads) ? { label: "El menos cargado", tone: "positive" } : null,
            roleTag,
        ]);

        return [
            {
                id: option.id,
                label: option.label,
                suggested: false,
                summary: usageSummary(usage, true),
                tags,
                score,
                blocked,
            },
        ];
    });

    return finish(ranked);
}

/**
 * Vehículos ordenados de más a menos recomendable.
 * - Manda el rendimiento (km/litro): el más económico va primero.
 * - Uno muy cargado de km o rutas en ±7 días baja en la lista.
 * - Desempata a favor del último que usó el conductor elegido.
 */
export function rankVehicles(
    options: SelectOption[],
    data: AssignmentData | null,
    driverId: string,
    driverLabel: string,
): Recommendation[] {
    if (!data) return plain(options);

    const usages = options.map((option) =>
        getUsage(data, (route) => (route.vehicleId === option.id ? "vehicle" : null)),
    );
    const loads = relativeLoads(usages, [(u) => u.routes, (u) => u.km]);

    const efficiencies = options.map((option) => data.kmPerLiter[option.id] ?? null);
    const known = efficiencies.filter((value): value is number => value !== null && value > 0);
    const bestEfficiency = known.length > 0 ? Math.max(...known) : null;

    // Vehículo de la última ruta (anterior a la fecha) que manejó el conductor elegido
    const lastVehicleId = driverId
        ? [...data.routes]
              .filter((route) => route.driverId === driverId && route.date < data.date)
              .sort((a, b) => b.date.localeCompare(a.date))[0]?.vehicleId
        : undefined;
    const driverFirstName = driverLabel.split(" ")[0];

    const ranked = options.map((option, i): Ranked => {
        const usage = usages[i];
        const load = loads[i];
        const overused = isOverused(load, usage);
        const efficiency = efficiencies[i];
        const blocked = usage.sameDay.length > 0;
        const isLastUsed = option.id === lastVehicleId;

        // 0 = el más económico, 1 = sin rendimiento cargado
        const economy =
            efficiency && bestEfficiency ? 1 - efficiency / bestEfficiency : 1;

        const score =
            economy +
            load * 0.15 +
            (overused ? 0.5 : 0) -
            (isLastUsed ? 0.1 : 0) +
            (blocked ? SAME_DAY_PENALTY : 0);

        const efficiencyTag: RecommendationTag =
            efficiency && efficiency === bestEfficiency && known.length > 1
                ? { label: `El más económico · ${formatNumber(efficiency)} km/l`, tone: "positive" }
                : efficiency
                  ? { label: `${formatNumber(efficiency)} km/l`, tone: "neutral" }
                  : { label: "Sin rendimiento cargado", tone: "neutral" };

        const tags = pickTags([
            blocked ? sameDayTag(usage.sameDay, "vehicle") : null,
            overused
                ? {
                      label: `Muy usado: ${usage.km > 0 ? `${formatNumber(usage.km, 0)} km` : `${usage.routes} rutas`}`,
                      tone: "warning",
                  }
                : null,
            efficiencyTag,
            isLastUsed ? { label: `El último que usó ${driverFirstName}`, tone: "positive" } : null,
            isLeastLoaded(load, loads) ? { label: "El menos usado", tone: "positive" } : null,
        ]);

        return {
            id: option.id,
            label: option.label,
            suggested: false,
            summary: usageSummary(usage, false),
            tags,
            score,
            blocked,
        };
    });

    return finish(ranked);
}
