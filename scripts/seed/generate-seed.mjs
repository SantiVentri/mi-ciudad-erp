// Genera supabase/seed.sql con datos ficticios para desarrollo.
//
//   npm run seed:generate            # genera el seed relativo a hoy
//   npx supabase db reset            # (local) o: npx supabase db reset --linked
//
// - Las fechas son relativas al día en que se corre: rutas completadas en los últimos
//   3 meses, rutas pendientes para hoy y pedidos pendientes hasta fin de mes.
//   Para refrescarlas, se vuelve a correr este script.
// - Los km y minutos de cada ruta se piden por calle a OpenRouteService (ORS_API_KEY).
//   Las respuestas se guardan en scripts/seed/.ors-cache.json para no repetir consultas.
// - La aleatoriedad usa una semilla fija por día: el mismo día genera el mismo seed.
// - Los precios de gasoil y los sueldos son estimaciones (ver FUEL y SALARY).
// - Los productos tienen precios con aumentos mensuales (PRODUCT_PRICES) y el stock se
//   simula en orden: producción o compras, pedidos que descuentan al crearse,
//   devoluciones por cancelación, roturas y conteos. El stock final sale de ahí.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLIENTS_SQL = join(ROOT, "scripts", "seed", "data", "clients.sql");
const CACHE_FILE = join(ROOT, "scripts", "seed", ".ors-cache.json");
const OUTPUT = join(ROOT, "supabase", "seed.sql");

// --- Parámetros ---------------------------------------------------------------

const DEV_PASSWORD = "MiCiudad2026!";
const HISTORY_MONTHS = 3;
const MAX_STOPS_PER_ROUTE = 12;
const STOP_SERVICE_MINUTES = 10; // igual que STOP_SERVICE_MINUTES de la app
const PAST_CANCEL_RATE = 0.06;
const FUTURE_CANCEL_RATE = 0.02;
const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car";
const ORS_DELAY_MS = 1600; // plan gratuito: 40 consultas por minuto
const ORS_TIMEOUT_MS = 20_000;

// Gasoil: precio de referencia al 1/11/2026 y aumento mensual promedio (estimación)
const FUEL = { referenceDate: "2026-11-01", referencePrice: 1980, monthlyIncrease: 0.02 };
// Sueldo bruto de un chofer de reparto (convenio de Camioneros) al 1/11/2026 (estimación)
const SALARY = {
    referenceDate: "2026-11-01",
    referenceMonthly: 1_950_000,
    monthlyIncrease: 0.018,
    socialChargesPct: 30,
    monthlyHours: 200, // 48 h semanales
};

// Feriados nacionales (no se reparte). Los trasladables son aproximados.
const HOLIDAYS = new Set([
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02", "2026-04-03",
    "2026-05-01", "2026-05-25", "2026-06-15", "2026-06-20", "2026-07-09", "2026-08-17",
    "2026-10-12", "2026-11-23", "2026-12-08", "2026-12-25",
    "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-24", "2027-03-26", "2027-04-02",
    "2027-05-01", "2027-05-25", "2027-06-17", "2027-06-20", "2027-07-09", "2027-08-16",
    "2027-10-11", "2027-11-22", "2027-12-08", "2027-12-25",
]);

const ADMIN = {
    id: "00000000-0000-4000-a000-000000000001",
    email: "santino.ventrice@gmail.com",
    firstName: "Santino",
    lastName: "Ventrice",
    phone: "011-5000-0001",
};

const DRIVERS = [
    { id: "00000000-0000-4000-a000-000000000011", firstName: "Héctor", lastName: "Villarreal", phone: "011-5000-0011", seniority: 1.12 },
    { id: "00000000-0000-4000-a000-000000000012", firstName: "Ramiro", lastName: "Ojeda", phone: "011-5000-0012", seniority: 1.05 },
    { id: "00000000-0000-4000-a000-000000000013", firstName: "Cristian", lastName: "Funes", phone: "011-5000-0013", seniority: 1.0 },
    { id: "00000000-0000-4000-a000-000000000014", firstName: "Walter", lastName: "Benegas", phone: "011-5000-0014", seniority: 0.97 },
    { id: "00000000-0000-4000-a000-000000000015", firstName: "Sergio", lastName: "Luna", phone: "011-5000-0015", seniority: 0.94 },
    { id: "00000000-0000-4000-a000-000000000016", firstName: "Nahuel", lastName: "Coronel", phone: "011-5000-0016", seniority: 0.9 },
];

const VEHICLES = [
    { id: "00000000-0000-4000-b000-000000000001", patent: "AG 156 BZ", model: "Kia K2500", kmPerLiter: 9.5 },
    { id: "00000000-0000-4000-b000-000000000002", patent: "FGB 915", model: "Mercedes-Benz Sprinter 315", kmPerLiter: 10.5 },
    { id: "00000000-0000-4000-b000-000000000003", patent: "KLP 482", model: "Renault Kangoo", kmPerLiter: 13 },
    { id: "00000000-0000-4000-b000-000000000004", patent: "FD639AC", model: "Renault Master", kmPerLiter: 11 },
    { id: "00000000-0000-4000-b000-000000000005", patent: "PQA 360", model: "Peugeot Partner", kmPerLiter: 12 },
];

// Mismos productos (e ids) que la base anterior. weight: qué tan seguido se piden.
// price: precio de lista actual (igual que la migración del módulo de stock).
// restock: "daily" = producción propia cada mañana; "weekly" = compra al proveedor los lunes.
const PRODUCTS = [
    { id: "b517c6f8-30c8-40b0-aaf6-4772ec300313", name: "Bidón 20 Litros", description: "Bidón de agua purificada retornable de 20L", weight: 0.45, maxQty: 6, price: 7500, minStock: 60, restock: "daily" },
    { id: "da563a7b-ebb5-4f8c-a18b-641b2eba221b", name: "Bidón 12 Litros", description: "Bidón de agua purificada retornable de 12L", weight: 0.3, maxQty: 6, price: 5600, minStock: 40, restock: "daily" },
    { id: "3b03ac70-0460-430c-baaa-0ff8a793e229", name: "Sifón de Soda 1.5L", description: "Sifón descartable o retornable de soda premium", weight: 0.2, maxQty: 6, price: 1500, minStock: 40, restock: "daily" },
    { id: "cdba6af2-3587-4f02-9fc5-5f27fca445e2", name: "Dispensador de Mesa", description: "Dispensador manual de agua para bidones de 10L y 20L", weight: 0.05, maxQty: 1, price: 18000, minStock: 5, restock: "weekly" },
];
const PRODUCTS_CREATED_AT = "2026-08-05T23:41:56.320Z";
// Aumento de los precios de lista el primer día hábil de cada mes (estimación)
const PRODUCT_PRICES = { monthlyIncrease: 0.035 };

// Coordenadas que caían a decenas de km de la ciudad del cliente
const COORDINATE_FIXES = {
    "12d5aa80-8e25-4b25-8d7e-51b90d9bf23c": [-34.6905, -58.6835], // Nicolás Ferreyra, Belgrano 200, Libertad
    "ac0c5db3-437f-4be4-bc6e-981eb65fd2ed": [-34.6612, -58.6745], // Maximiliano Bustos, San Lorenzo 900, Ituzaingó
    "9f9e1655-3e80-40d3-9c16-f9d6a3c70e37": [-34.6985, -58.689], // Bruno Cardozo, Guido 800, Libertad
};

// Al este de esta longitud las rutas usan el Acceso Oeste (Castelar, Haedo, Morón, CABA)
const TOLL_LONGITUDE = -58.655;

// --- Utilidades ---------------------------------------------------------------

function readEnv() {
    const env = {};
    for (const file of [".env.development", ".env.local"]) {
        const path = join(ROOT, file);
        if (!existsSync(path)) continue;
        for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (!match) continue;
            env[match[1]] = match[2].replace(/^["']|["']$/g, "");
        }
    }
    return { ...env, ...process.env };
}

// Generador pseudoaleatorio con semilla (mulberry32)
function createRng(seedText) {
    let seed = 0;
    for (const char of seedText) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0;
    return () => {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const todayKeyAR = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

const keyToDate = (key) => new Date(`${key}T00:00:00Z`);
const dateToKey = (date) => date.toISOString().slice(0, 10);
const addDays = (key, days) => dateToKey(new Date(keyToDate(key).getTime() + days * 86_400_000));
const weekday = (key) => keyToDate(key).getUTCDay(); // 0 = domingo
const isWorkday = (key) => weekday(key) !== 0 && !HOLIDAYS.has(key);
const monthsBetween = (fromKey, toKey) => (keyToDate(toKey) - keyToDate(fromKey)) / (30.44 * 86_400_000);

function addMonths(key, months) {
    const date = keyToDate(key);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
    return dateToKey(target);
}

const endOfMonth = (key) => {
    const date = keyToDate(key);
    return dateToKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
};

// Instante en hora argentina (UTC-3, sin horario de verano) a partir del día y los minutos
const atAR = (key, minutes) => new Date(new Date(`${key}T00:00:00-03:00`).getTime() + minutes * 60_000);

function haversineKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- SQL ----------------------------------------------------------------------

// Expresión SQL que se escribe tal cual (por ejemplo, una llamada a función)
class RawSql {
    constructor(text) {
        this.text = text;
    }
}

function sql(value) {
    if (value instanceof RawSql) return value.text;
    if (value === null || value === undefined) return "null";
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table, columns, rows, chunkSize = 400) {
    if (rows.length === 0) return `-- ${table}: sin filas\n`;
    const parts = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
        const values = rows
            .slice(i, i + chunkSize)
            .map((row) => `  (${row.map(sql).join(", ")})`)
            .join(",\n");
        parts.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};\n`);
    }
    return parts.join("\n");
}

// Lee los valores del INSERT de clientes (strings entre comillas, null, true, false)
function parseClients() {
    const text = readFileSync(CLIENTS_SQL, "utf8");
    const columns = text.match(/INSERT INTO public\.clients \(([^)]+)\)/)[1].split(",").map((c) => c.trim());
    const body = text.slice(text.indexOf("VALUES") + 6);
    const rows = [];
    let row = null;
    let i = 0;
    while (i < body.length) {
        const char = body[i];
        if (char === "(" && row === null) {
            row = [];
            i++;
        } else if (char === ")" && row !== null) {
            rows.push(Object.fromEntries(columns.map((column, index) => [column, row[index]])));
            row = null;
            i++;
        } else if (row !== null && char === "'") {
            let value = "";
            i++;
            while (i < body.length) {
                if (body[i] === "'" && body[i + 1] === "'") {
                    value += "'";
                    i += 2;
                } else if (body[i] === "'") {
                    i++;
                    break;
                } else {
                    value += body[i++];
                }
            }
            row.push(value);
        } else if (row !== null && /[a-z]/i.test(char)) {
            const word = body.slice(i).match(/^[a-z]+/i)[0];
            row.push(word === "null" ? null : word === "true");
            i += word.length;
        } else {
            i++;
        }
    }
    return rows.map((client) => {
        const fix = COORDINATE_FIXES[client.id];
        return {
            ...client,
            latitude: fix ? fix[0] : Number(client.latitude),
            longitude: fix ? fix[1] : Number(client.longitude),
        };
    });
}

// --- Rutas --------------------------------------------------------------------

// Agrupa las paradas por zona: barrido angular alrededor del depósito,
// empezando en el hueco más grande para no partir un grupo de clientes al medio
function splitByZone(depot, orders, routesCount) {
    const withAngle = orders
        .map((order) => ({ order, angle: Math.atan2(order.lat - depot.lat, order.lng - depot.lng) }))
        .sort((a, b) => a.angle - b.angle);
    let gapIndex = 0;
    let biggestGap = -1;
    for (let i = 0; i < withAngle.length; i++) {
        const next = withAngle[(i + 1) % withAngle.length].angle + (i + 1 === withAngle.length ? 2 * Math.PI : 0);
        const gap = next - withAngle[i].angle;
        if (gap > biggestGap) {
            biggestGap = gap;
            gapIndex = (i + 1) % withAngle.length;
        }
    }
    const rotated = [...withAngle.slice(gapIndex), ...withAngle.slice(0, gapIndex)].map((item) => item.order);
    const groups = [];
    let start = 0;
    for (let g = 0; g < routesCount; g++) {
        const size = Math.floor(rotated.length / routesCount) + (g < rotated.length % routesCount ? 1 : 0);
        groups.push(rotated.slice(start, start + size));
        start += size;
    }
    return groups;
}

// Vecino más cercano + 2-opt sobre el circuito depósito → paradas → depósito
function orderStops(depot, stops) {
    const remaining = [...stops];
    const tour = [];
    let current = depot;
    while (remaining.length > 0) {
        let best = 0;
        for (let i = 1; i < remaining.length; i++) {
            if (haversineKm(current, remaining[i]) < haversineKm(current, remaining[best])) best = i;
        }
        current = remaining.splice(best, 1)[0];
        tour.push(current);
    }
    const at = (i) => (i < 0 || i >= tour.length ? depot : tour[i]);
    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 0; i < tour.length - 1; i++) {
            for (let j = i + 1; j < tour.length; j++) {
                const before = haversineKm(at(i - 1), at(i)) + haversineKm(at(j), at(j + 1));
                const after = haversineKm(at(i - 1), at(j)) + haversineKm(at(i), at(j + 1));
                if (after + 1e-9 < before) {
                    tour.splice(i, j - i + 1, ...tour.slice(i, j + 1).reverse());
                    improved = true;
                }
            }
        }
    }
    return tour;
}

function loadCache() {
    if (!existsSync(CACHE_FILE)) return {};
    try {
        return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    } catch {
        return {};
    }
}

async function fetchRouteMetrics(points, apiKey, cache) {
    const coordinates = points.map((point) => [Number(point.lng.toFixed(6)), Number(point.lat.toFixed(6))]);
    const key = JSON.stringify(coordinates);
    if (cache[key]) return { ...cache[key], cached: true };

    for (let attempt = 1; attempt <= 5; attempt++) {
        let response;
        try {
            response = await fetch(ORS_URL, {
                method: "POST",
                headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ coordinates, instructions: false }),
                signal: AbortSignal.timeout(ORS_TIMEOUT_MS),
            });
        } catch (error) {
            if (attempt === 5) throw new Error(`OpenRouteService no respondió: ${error.message}`);
            await sleep(5_000 * attempt);
            continue;
        }
        if (response.status === 429) {
            await sleep(15_000 * attempt);
            continue;
        }
        if (!response.ok) {
            throw new Error(`OpenRouteService respondió ${response.status}: ${await response.text()}`);
        }
        const data = await response.json();
        const summary = data.routes?.[0]?.summary;
        if (!summary) throw new Error("OpenRouteService no devolvió el resumen de la ruta.");
        const metrics = {
            distanceKm: Math.round((summary.distance ?? 0) / 10) / 100,
            driveMin: Math.round((summary.duration ?? 0) / 60),
        };
        cache[key] = metrics;
        return { ...metrics, cached: false };
    }
    throw new Error("OpenRouteService sigue limitando las consultas (429). Probá de nuevo en unos minutos.");
}

// --- Generación ---------------------------------------------------------------

async function main() {
    const env = readEnv();
    const apiKey = env.ORS_API_KEY;
    if (!apiKey) {
        throw new Error("Falta ORS_API_KEY en .env.development o .env.local: hace falta para calcular los km por calle.");
    }
    const depot = {
        lat: Number(env.NEXT_PUBLIC_DEPOT_LATITUDE) || -34.6654,
        lng: Number(env.NEXT_PUBLIC_DEPOT_LONGITUDE) || -58.7277,
    };

    const today = todayKeyAR();
    const rng = createRng(`mi-ciudad-erp-${today}`);
    const rand = (min, max) => min + rng() * (max - min);
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    const pick = (items) => items[Math.floor(rng() * items.length)];
    const shuffle = (items) => {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };
    const uuid = () => {
        const hex = Array.from({ length: 32 }, () => Math.floor(rng() * 16).toString(16)).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${"89ab"[Math.floor(rng() * 4)]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    };

    const historyStart = addMonths(today, -HISTORY_MONTHS);
    const horizonEnd = (() => {
        const end = endOfMonth(today);
        return (keyToDate(end) - keyToDate(today)) / 86_400_000 < 10 ? endOfMonth(addDays(end, 1)) : end;
    })();

    console.log(`Hoy: ${today} · historial desde ${historyStart} · pedidos hasta ${horizonEnd}`);

    // --- Usuarios ---
    const people = [
        { ...ADMIN, role: "admin" },
        ...DRIVERS.map((driver) => ({ ...driver, role: "driver" })),
    ].map((person) => ({
        ...person,
        email: person.email ?? `${person.firstName}.${person.lastName}@miciudad.test`
            .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
        invitationId: uuid(),
        createdAt: atAR(addDays(historyStart, -30), 10 * 60),
    }));

    // --- Clientes ---
    const clients = parseClients().map((client) => ({
        ...client,
        // Probabilidad de pedir en un día hábil: cada cliente tiene su propio ritmo
        orderRate: rand(0.15, 0.55),
        activeFrom: addDays(client.created_at.slice(0, 10), 1),
        activeUntil: client.is_active ? null : client.updated_at.slice(0, 10),
    }));

    // --- Pedidos ---
    const pickProduct = () => {
        let roll = rng();
        for (const product of PRODUCTS) {
            roll -= product.weight;
            if (roll <= 0) return product;
        }
        return PRODUCTS[0];
    };
    const quantity = (product) => {
        if (product.maxQty === 1) return 1;
        const roll = rng();
        return roll < 0.3 ? 1 : roll < 0.55 ? 2 : roll < 0.73 ? 3 : roll < 0.87 ? 4 : roll < 0.95 ? 5 : 6;
    };

    const now = new Date();
    const orders = [];
    const orderDetails = [];
    const days = [];
    for (let day = historyStart; day <= horizonEnd; day = addDays(day, 1)) {
        if (isWorkday(day)) days.push(day);
    }

    for (const day of days) {
        const dayFactor = rand(0.7, 1.3) * (weekday(day) === 6 ? 0.6 : 1);
        for (const client of clients) {
            if (day < client.activeFrom || (client.activeUntil && day > client.activeUntil)) continue;
            if (rng() >= Math.min(0.95, client.orderRate * dayFactor)) continue;

            const isPast = day < today;
            const isToday = day === today;
            const cancelled = rng() < (isPast ? PAST_CANCEL_RATE : isToday ? 0 : FUTURE_CANCEL_RATE);
            const leadDays = randInt(1, 4);
            let createdAt = atAR(addDays(day, -leadDays), randInt(9 * 60, 19 * 60));
            if (createdAt > now) createdAt = new Date(now.getTime() - rand(1, 72) * 3_600_000);

            const order = {
                id: uuid(),
                clientId: client.id,
                lat: client.latitude,
                lng: client.longitude,
                day,
                createdAt,
                state: cancelled ? "Cancelada" : isPast ? "Completada" : isToday ? "Asignada" : "Pendiente",
                // Los cancelados se cancelan entre el alta y la fecha de entrega
                updatedAt: cancelled
                    ? new Date(Math.min(now.getTime(), createdAt.getTime() + rand(1, leadDays * 20) * 3_600_000))
                    : createdAt,
            };
            orders.push(order);

            const lines = rng() < 0.55 ? 1 : rng() < 0.78 ? 2 : 3;
            const used = new Set();
            for (let l = 0; l < lines; l++) {
                const product = pickProduct();
                if (used.has(product.id)) continue;
                used.add(product.id);
                orderDetails.push([uuid(), order.id, product.id, quantity(product), createdAt]);
            }
        }
    }

    // --- Rutas (días pasados y hoy) ---
    const cache = loadCache();
    const routes = [];
    const stops = [];
    const expenses = [];
    const routeDays = days.filter((day) => day <= today);
    let orsCalls = 0;

    for (const day of routeDays) {
        const dayOrders = orders.filter((order) => order.day === day && order.state !== "Cancelada");
        if (dayOrders.length === 0) continue;

        const routesCount = Math.ceil(dayOrders.length / MAX_STOPS_PER_ROUTE);
        const groups = splitByZone(depot, dayOrders, routesCount);
        // 3 duplas y 3 vehículos por día, rotando combinaciones. Si hay más rutas que duplas,
        // la misma dupla sale de nuevo cuando termina la anterior (no hay límite por día)
        const drivers = shuffle(DRIVERS);
        const crews = [0, 1, 2].map((i) => (rng() < 0.5 ? [drivers[2 * i], drivers[2 * i + 1]] : [drivers[2 * i + 1], drivers[2 * i]]));
        const vehicles = shuffle(VEHICLES).slice(0, 3);
        const crewFreeAt = [null, null, null];
        const isPast = day < today;

        for (let index = 0; index < groups.length; index++) {
            const crewIndex = index % 3;
            const [driver, coDriver] = crews[crewIndex];
            const vehicle = vehicles[crewIndex];
            const ordered = orderStops(depot, groups[index]);

            const metrics = await fetchRouteMetrics([depot, ...ordered, depot], apiKey, cache);
            if (!metrics.cached) {
                orsCalls++;
                if (orsCalls % 10 === 0) {
                    console.log(`  ${orsCalls} rutas consultadas a OpenRouteService (día ${day})…`);
                    writeFileSync(CACHE_FILE, JSON.stringify(cache)); // por si se corta a mitad
                }
                await sleep(ORS_DELAY_MS);
            }
            const estimatedMin = metrics.driveMin + STOP_SERVICE_MINUTES * ordered.length;

            const route = {
                id: uuid(),
                day,
                driverId: driver.id,
                coDriverId: coDriver.id,
                vehicleId: vehicle.id,
                state: isPast ? "Completada" : "Pendiente",
                distanceKm: metrics.distanceKm,
                estimatedMin,
                startedAt: null,
                finishedAt: null,
                createdAt: atAR(addDays(day, -1), randInt(15 * 60, 19 * 60)),
            };

            if (isPast) {
                const startMin = crewFreeAt[crewIndex]
                    ? crewFreeAt[crewIndex] + randInt(30, 60)
                    : randInt(7 * 60 + 45, 8 * 60 + 30);
                // Real vs estimado: la mayoría tarda un poco más de lo previsto
                const actualMin = Math.round(estimatedMin * rand(0.85, 1.35));
                route.startedAt = atAR(day, startMin);
                route.finishedAt = atAR(day, startMin + actualMin);
                crewFreeAt[crewIndex] = startMin + actualMin;

                const routeStart = route.startedAt.getTime();
                const during = () => new Date(routeStart + rand(0.1, 0.9) * actualMin * 60_000);
                const author = () => (rng() < 0.7 ? driver.id : coDriver.id);
                if (ordered.some((stop) => stop.lng > TOLL_LONGITUDE) && rng() < 0.85) {
                    expenses.push([uuid(), route.id, "toll", Math.round(rand(5600, 7200) / 10) * 10, "Peaje Acceso Oeste (ida y vuelta)", author(), during()]);
                }
                if (rng() < 0.12) {
                    expenses.push([uuid(), route.id, "parking", Math.round(rand(1500, 3500) / 50) * 50, pick(["Estacionamiento medido", "Playa de estacionamiento", null]), author(), during()]);
                }
                if (rng() < 0.015) {
                    expenses.push([uuid(), route.id, "fine", Math.round(rand(45000, 95000) / 500) * 500, "Multa por estacionar en doble fila", author(), during()]);
                }
                if (rng() < 0.04) {
                    const [note, min, max] = pick([["Gomería: arreglo de pinchadura", 12000, 25000], ["Lavado de la camioneta", 8000, 15000], ["Agua y refrigerio para la cuadrilla", 4000, 9000]]);
                    expenses.push([uuid(), route.id, "other", Math.round(rand(min, max) / 100) * 100, note, author(), during()]);
                }
            }
            routes.push(route);

            ordered.forEach((order, position) => {
                stops.push([uuid(), route.id, order.id, position + 1, isPast ? "Completada" : "Pendiente", route.createdAt]);
                if (isPast) order.updatedAt = new Date(route.startedAt.getTime() + ((position + 1) / (ordered.length + 1)) * (route.finishedAt - route.startedAt));
            });
        }
    }

    writeFileSync(CACHE_FILE, JSON.stringify(cache));

    // --- Precios de gasoil y sueldos ---
    const fuelPrices = [];
    for (let date = addDays(historyStart, -20); date <= today; date = addDays(date, randInt(28, 38))) {
        const price = FUEL.referencePrice * (1 + FUEL.monthlyIncrease) ** monthsBetween(FUEL.referenceDate, date) * rand(0.99, 1.01);
        fuelPrices.push([Math.round(price / 10) * 10, date]);
    }

    const salaries = [];
    const firstMonth = addMonths(historyStart.slice(0, 8) + "01", -1);
    for (let month = firstMonth; month <= today; month = addMonths(month, 1)) {
        for (const driver of DRIVERS) {
            const amount = SALARY.referenceMonthly * driver.seniority * (1 + SALARY.monthlyIncrease) ** monthsBetween(SALARY.referenceDate, month);
            salaries.push([driver.id, Math.round(amount / 1000) * 1000, SALARY.socialChargesPct, SALARY.monthlyHours, month]);
        }
    }

    // --- Precios de productos ---
    // Semilla propia: no cambia la secuencia del resto del seed
    const stockRng = createRng(`mi-ciudad-erp-stock-${today}`);
    const stockRandInt = (min, max) => Math.floor(min + stockRng() * (max - min + 1));
    const stockUuid = () => {
        const hex = Array.from({ length: 32 }, () => Math.floor(stockRng() * 16).toString(16)).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${"89ab"[Math.floor(stockRng() * 4)]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    };

    const productsCreatedAt = new Date(PRODUCTS_CREATED_AT);
    const priceChangeDays = [];
    for (let month = addMonths(PRODUCTS_CREATED_AT.slice(0, 8) + "01", 1); month <= today; month = addMonths(month, 1)) {
        let day = month;
        while (!isWorkday(day)) day = addDays(day, 1);
        if (day <= today) priceChangeDays.push(day);
    }

    // Por producto: [{ at, price }] de más viejo a más nuevo; el último es el precio actual
    const priceSteps = new Map();
    const productPrices = [];
    for (const product of PRODUCTS) {
        const roundTo = product.price >= 5000 ? 100 : 50;
        const steps = [productsCreatedAt, ...priceChangeDays.map((day) => atAR(day, 8 * 60))].map((at, k, all) => ({
            at,
            price: k === all.length - 1
                ? product.price
                : Math.round(product.price / (1 + PRODUCT_PRICES.monthlyIncrease) ** (all.length - 1 - k) / roundTo) * roundTo,
        }));
        priceSteps.set(product.id, steps);
        steps.forEach((step, k) => {
            productPrices.push([stockUuid(), product.id, step.price, k === 0 ? null : steps[k - 1].price, ADMIN.id, step.at]);
        });
    }
    const priceAt = (productId, at) => {
        const steps = priceSteps.get(productId);
        let price = steps[0].price;
        for (const step of steps) if (step.at <= at) price = step.price;
        return price;
    };

    // --- Stock ---
    // Cada pedido descuenta al crearse; los cancelados devuelven al cancelarse
    const ordersById = new Map(orders.map((order) => [order.id, order]));
    const productById = new Map(PRODUCTS.map((product) => [product.id, product]));
    const events = [];
    const demand = new Map(PRODUCTS.map((product) => [product.id, 0]));
    for (const [, orderId, productId, quantity, createdAt] of orderDetails) {
        const order = ordersById.get(orderId);
        events.push({ at: createdAt, productId, delta: -quantity, type: "pedido", reason: null, orderId });
        if (order.state === "Cancelada") {
            events.push({ at: order.updatedAt, productId, delta: quantity, type: "devolucion", reason: "Pedido cancelado", orderId });
        } else {
            demand.set(productId, demand.get(productId) + quantity);
        }
    }
    const dailyDemand = (product) => demand.get(product.id) / days.length;
    const roundUp = (value, step) => Math.ceil(value / step) * step;
    // Producción: cubre 4 días de demanda más el mínimo
    const productionTarget = (product) => roundUp(dailyDemand(product) * 4 + product.minStock, 10);

    // Roturas y conteos (se aplican solo si el stock alcanza)
    const firstStockDay = addDays(PRODUCTS_CREATED_AT.slice(0, 10), 1);
    const breakageReasons = ["Rotura en el depósito", "Bidón fisurado en la carga", "Envase con pérdida, descartado"];
    for (let day = firstStockDay; day <= today; day = addDays(day, 1)) {
        if (!isWorkday(day)) continue;
        if (stockRng() < 0.15) {
            const product = PRODUCTS[stockRandInt(0, 2)];
            events.push({
                at: atAR(day, 16 * 60 + stockRandInt(0, 120)), productId: product.id, delta: -stockRandInt(1, 3),
                type: "egreso", reason: breakageReasons[stockRandInt(0, breakageReasons.length - 1)], orderId: null,
            });
        }
        // Conteo del depósito el último día hábil del mes
        let next = addDays(day, 1);
        while (!isWorkday(next)) next = addDays(next, 1);
        if (next.slice(0, 7) !== day.slice(0, 7)) {
            for (const product of PRODUCTS) {
                if (stockRng() < 0.5) continue;
                const delta = (stockRng() < 0.6 ? -1 : 1) * stockRandInt(1, 2);
                events.push({ at: atAR(day, 18 * 60), productId: product.id, delta, type: "ajuste", reason: "Conteo mensual del depósito", orderId: null });
            }
        }
    }
    events.sort((a, b) => a.at - b.at);

    const stockOf = new Map(PRODUCTS.map((product) => [product.id, 0]));
    const stockMovements = [];
    const move = (at, productId, delta, type, reason, orderId) => {
        const after = stockOf.get(productId) + delta;
        stockOf.set(productId, after);
        stockMovements.push([stockUuid(), productId, type, delta, after, reason, orderId, ADMIN.id, at]);
    };
    let nextEvent = 0;
    const applyEventsUntil = (limit) => {
        while (nextEvent < events.length && events[nextEvent].at <= limit) {
            const event = events[nextEvent++];
            const current = stockOf.get(event.productId);
            if (event.type === "egreso" || event.type === "ajuste") {
                if (current + event.delta >= 0) move(event.at, event.productId, event.delta, event.type, event.reason, null);
                continue;
            }
            // Un pedido que no entra: producción extra o compra urgente justo antes
            if (current + event.delta < 0) {
                const product = productById.get(event.productId);
                const extra = product.restock === "daily"
                    ? roundUp(-(current + event.delta) + dailyDemand(product) * 2, 10)
                    : 12;
                move(new Date(event.at.getTime() - 60_000), product.id, extra, "ingreso",
                    product.restock === "daily" ? "Producción extra" : "Compra urgente al proveedor", null);
            }
            move(event.at, event.productId, event.delta, event.type, event.reason, event.orderId);
        }
    };

    for (let day = firstStockDay; day <= today; day = addDays(day, 1)) {
        const morning = atAR(day, 7 * 60);
        if (morning > now) break;
        applyEventsUntil(morning);
        if (!isWorkday(day)) continue;
        for (const product of PRODUCTS) {
            const current = stockOf.get(product.id);
            if (day === firstStockDay) {
                const initial = product.restock === "daily" ? productionTarget(product) : 24;
                move(morning, product.id, initial, "ingreso", "Stock inicial", null);
            } else if (product.restock === "daily") {
                const target = productionTarget(product);
                if (current < target * 0.6) move(morning, product.id, roundUp(target - current, 10), "ingreso", "Producción del día", null);
            } else if (weekday(day) === 1 && current < 15) {
                move(morning, product.id, 24, "ingreso", "Compra al proveedor (2 cajas x12)", null);
            }
        }
    }
    applyEventsUntil(now);

    // --- SQL ---
    const out = [];
    out.push(`-- =====================================================================
-- Datos ficticios para desarrollo. Generado por scripts/seed/generate-seed.mjs
-- el ${today}. NO editar a mano: cambiá el script y volvé a generarlo con
--   npm run seed:generate
-- Usuarios (contraseña para todos: ${DEV_PASSWORD}):
${people.map((person) => `--   ${person.role.padEnd(6)} ${person.email}`).join("\n")}
-- Historial: ${historyStart} a ${addDays(today, -1)} · hoy: rutas pendientes · pedidos hasta ${horizonEnd}
-- ${orders.length} pedidos, ${routes.length} rutas, ${stops.length} paradas, ${expenses.length} gastos, ${stockMovements.length} movimientos de stock
-- =====================================================================

BEGIN;
`);

    out.push("-- Invitaciones (el trigger de auth.users las exige y marca como usadas)");
    out.push(insert("public.invitations", ["id", "email", "role", "created_at"],
        people.map((person) => [person.invitationId, person.email, person.role, person.createdAt])));

    out.push("-- Usuarios: el trigger asigna app_metadata.role y crea el perfil");
    out.push(insert("auth.users",
        ["instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "raw_app_meta_data", "raw_user_meta_data",
            "created_at", "updated_at", "confirmation_token", "recovery_token", "email_change_token_new", "email_change"],
        people.map((person) => [
            "00000000-0000-0000-0000-000000000000", person.id, "authenticated", "authenticated", person.email,
            new RawSql(`extensions.crypt(${sql(DEV_PASSWORD)}, extensions.gen_salt('bf'))`), person.createdAt,
            { provider: "email", providers: ["email"] },
            { invite_token: person.invitationId, first_name: person.firstName, last_name: person.lastName, display_name: person.firstName.toLowerCase() },
            person.createdAt, person.createdAt, "", "", "", "",
        ])));

    out.push(insert("auth.identities", ["id", "provider_id", "user_id", "identity_data", "provider", "created_at", "updated_at"],
        people.map((person) => [uuid(), person.id, person.id, { sub: person.id, email: person.email, email_verified: true }, "email", person.createdAt, person.createdAt])));

    out.push(people.map((person) => `UPDATE public.profiles SET phone = ${sql(person.phone)} WHERE id = ${sql(person.id)};`).join("\n") + "\n");

    out.push("-- Productos (stock final de la simulación)");
    out.push(insert("public.products", ["id", "name", "description", "price", "stock", "min_stock", "is_active", "created_at"],
        PRODUCTS.map((product) => [product.id, product.name, product.description, product.price, stockOf.get(product.id),
            product.minStock, true, productsCreatedAt])));

    out.push("-- Historial de precios: el trigger registró el precio actual al insertar; se reemplaza por los aumentos mensuales");
    out.push("DELETE FROM public.product_prices;\n");
    out.push(insert("public.product_prices", ["id", "product_id", "price", "previous_price", "created_by", "created_at"], productPrices));

    out.push("-- Clientes (coordenadas corregidas: ver COORDINATE_FIXES en el script)");
    out.push(insert("public.clients",
        ["id", "name", "email", "phone", "street", "number", "city", "province", "latitude", "longitude", "created_at", "is_active", "observations", "updated_at"],
        clients.map((client) => [client.id, client.name, client.email, client.phone, client.street, client.number, client.city, client.province,
            client.latitude, client.longitude, client.created_at, client.is_active, client.observations, client.updated_at])));

    out.push("-- Vehículos");
    out.push(insert("public.vehicles", ["id", "patent", "model", "km_per_liter", "is_active", "created_at"],
        VEHICLES.map((vehicle) => [vehicle.id, vehicle.patent, vehicle.model, vehicle.kmPerLiter, true, "2026-08-05 23:30:00+00"])));

    out.push("-- Gasoil (precio por litro, estimado). En orden: el trigger cierra el precio anterior");
    out.push(fuelPrices.map(([price, date]) => `INSERT INTO public.fuel_prices (price_per_liter, valid_from) VALUES (${price}, '${date}');`).join("\n") + "\n");

    out.push("-- Sueldos (estimados, aumento mensual). En orden: el trigger cierra el anterior de cada empleado");
    out.push(salaries.map((row) =>
        `INSERT INTO public.salaries (profile_id, monthly_salary, social_charges_pct, monthly_hours, valid_from) VALUES (${row.map(sql).join(", ")});`).join("\n") + "\n");

    out.push("-- Pedidos");
    out.push(insert("public.orders", ["id", "client_id", "arrival_date", "state", "created_at", "updated_at"],
        orders.map((order) => [order.id, order.clientId, `${order.day}T00:00:00Z`, order.state, order.createdAt, order.updatedAt])));
    out.push(insert("public.order_details", ["id", "order_id", "product_id", "quantity", "unit_price", "created_at"],
        orderDetails.map(([id, orderId, productId, quantity, createdAt]) => [id, orderId, productId, quantity, priceAt(productId, createdAt), createdAt])));

    out.push("-- Movimientos de stock (en orden: stock_after es el stock que quedó después de cada uno)");
    out.push(insert("public.stock_movements",
        ["id", "product_id", "type", "quantity", "stock_after", "reason", "order_id", "created_by", "created_at"], stockMovements));

    out.push("-- Rutas (en orden cronológico: route_number sale de la identidad)");
    out.push(insert("public.routes",
        ["id", "driver_id", "co_driver_id", "vehicle_id", "route_date", "state", "estimated_distance_km", "estimated_duration_min", "started_at", "finished_at", "created_at", "updated_at"],
        routes.map((route) => [route.id, route.driverId, route.coDriverId, route.vehicleId, `${route.day}T00:00:00Z`, route.state,
            route.distanceKm, route.estimatedMin, route.startedAt, route.finishedAt, route.createdAt, route.finishedAt ?? route.createdAt])));
    out.push(insert("public.stops", ["id", "route_id", "order_id", "visit_order", "state", "created_at"], stops));
    out.push(insert("public.route_expenses", ["id", "route_id", "type", "amount", "notes", "created_by", "created_at"], expenses));

    out.push(`-- Costo estimado de cada ruta con los precios y sueldos vigentes en su fecha
INSERT INTO public.route_costs (route_id, estimated_fuel_cost, estimated_labor_cost)
SELECT r.id, c.fuel_cost, c.labor_cost
  FROM public.routes r
 CROSS JOIN LATERAL public.estimate_route_cost(
   r.vehicle_id, r.driver_id, r.co_driver_id, r.estimated_distance_km, r.estimated_duration_min,
   (r.route_date AT TIME ZONE 'UTC')::date
 ) c
 WHERE r.estimated_distance_km IS NOT NULL;

COMMIT;
`);

    writeFileSync(OUTPUT, out.join("\n"));
    console.log(`Listo: ${OUTPUT}`);
    console.log(`${orders.length} pedidos (${orders.filter((o) => o.state === "Cancelada").length} cancelados), ${routes.length} rutas, ${stops.length} paradas, ${expenses.length} gastos, ${fuelPrices.length} precios, ${salaries.length} sueldos`);
    console.log(`Stock final: ${PRODUCTS.map((product) => `${product.name} ${stockOf.get(product.id)} (mín. ${product.minStock})`).join(", ")} · ${stockMovements.length} movimientos`);
    console.log(`Consultas nuevas a OpenRouteService: ${orsCalls}`);
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
