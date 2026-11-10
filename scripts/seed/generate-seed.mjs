// Genera supabase/seed.sql con datos ficticios para el esquema de la v1.0.
//
//   npm run seed:generate            # genera el seed relativo a hoy
//   npx supabase db reset            # (local) o: npx supabase db reset --linked
//
// - Las fechas son relativas al día en que se corre: rutas completadas en los últimos
//   3 meses, rutas pendientes para hoy y pedidos pendientes hasta fin de mes.
//   Para refrescarlas, se vuelve a correr este script.
// - La aleatoriedad usa una semilla fija por día: el mismo día genera el mismo seed.
// - La v1.0 no tiene precios, stock ni costos: solo usuarios, clientes, vehículos,
//   productos, pedidos y rutas. Las rutas se arman por zona y se ordenan en línea
//   recta (vecino más cercano + 2-opt), sin consultar ningún servicio externo.
// - Cada cuadrilla hace hasta 2 vueltas por día (routes.trip_number).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLIENTS_SQL = join(ROOT, "scripts", "seed", "data", "clients.sql");
const OUTPUT = join(ROOT, "supabase", "seed.sql");

// --- Parámetros ---------------------------------------------------------------

const DEV_PASSWORD = "MiCiudad2026!";
const HISTORY_MONTHS = 3;
const MAX_STOPS_PER_ROUTE = 12;
// Cuadrillas por día y vueltas por cuadrilla (CHECK routes_trip_number_check: 1 o 2)
const CREWS_PER_DAY = 3;
const MAX_TRIPS = 2;
const PAST_CANCEL_RATE = 0.06;
const FUTURE_CANCEL_RATE = 0.02;
const DEPOT = { lat: -34.6654, lng: -58.7277 }; // Embotelladora (Merlo)

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
    { id: "00000000-0000-4000-a000-000000000011", firstName: "Héctor", lastName: "Villarreal", phone: "011-5000-0011" },
    { id: "00000000-0000-4000-a000-000000000012", firstName: "Ramiro", lastName: "Ojeda", phone: "011-5000-0012" },
    { id: "00000000-0000-4000-a000-000000000013", firstName: "Cristian", lastName: "Funes", phone: "011-5000-0013" },
    { id: "00000000-0000-4000-a000-000000000014", firstName: "Walter", lastName: "Benegas", phone: "011-5000-0014" },
    { id: "00000000-0000-4000-a000-000000000015", firstName: "Sergio", lastName: "Luna", phone: "011-5000-0015" },
    { id: "00000000-0000-4000-a000-000000000016", firstName: "Nahuel", lastName: "Coronel", phone: "011-5000-0016" },
];

const VEHICLES = [
    { id: "00000000-0000-4000-b000-000000000001", patent: "AG 156 BZ", model: "Kia K2500" },
    { id: "00000000-0000-4000-b000-000000000002", patent: "FGB 915", model: "Mercedes-Benz Sprinter 315" },
    { id: "00000000-0000-4000-b000-000000000003", patent: "KLP 482", model: "Renault Kangoo" },
    { id: "00000000-0000-4000-b000-000000000004", patent: "FD639AC", model: "Renault Master" },
    { id: "00000000-0000-4000-b000-000000000005", patent: "PQA 360", model: "Peugeot Partner" },
];

// Mismos productos (e ids) que desarrollo. share: qué tan seguido se piden.
const PRODUCTS = [
    { id: "b517c6f8-30c8-40b0-aaf6-4772ec300313", name: "Bidón 20 Litros", description: "Bidón de agua purificada retornable de 20L", share: 0.45, maxQty: 6 },
    { id: "da563a7b-ebb5-4f8c-a18b-641b2eba221b", name: "Bidón 12 Litros", description: "Bidón de agua purificada retornable de 12L", share: 0.3, maxQty: 6 },
    { id: "3b03ac70-0460-430c-baaa-0ff8a793e229", name: "Sifón de Soda 1.5L", description: "Sifón descartable o retornable de soda premium", share: 0.2, maxQty: 6 },
    { id: "cdba6af2-3587-4f02-9fc5-5f27fca445e2", name: "Dispensador de Mesa", description: "Dispensador manual de agua para bidones de 10L y 20L", share: 0.05, maxQty: 1 },
];
const PRODUCTS_CREATED_AT = "2026-08-05T23:41:56.320Z";

// Coordenadas que caían a decenas de km de la ciudad del cliente
const COORDINATE_FIXES = {
    "12d5aa80-8e25-4b25-8d7e-51b90d9bf23c": [-34.6905, -58.6835], // Nicolás Ferreyra, Belgrano 200, Libertad
    "ac0c5db3-437f-4be4-bc6e-981eb65fd2ed": [-34.6612, -58.6745], // Maximiliano Bustos, San Lorenzo 900, Ituzaingó
    "9f9e1655-3e80-40d3-9c16-f9d6a3c70e37": [-34.6985, -58.689], // Bruno Cardozo, Guido 800, Libertad
};

// --- Utilidades ---------------------------------------------------------------

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

// --- Generación ---------------------------------------------------------------

function main() {
    const today = todayKeyAR();
    const rng = createRng(`mi-ciudad-erp-v1-${today}`);
    const rand = (min, max) => min + rng() * (max - min);
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
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
            roll -= product.share;
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
    const routes = [];
    const stops = [];

    for (const day of days.filter((key) => key <= today)) {
        const dayOrders = orders.filter((order) => order.day === day && order.state !== "Cancelada");
        if (dayOrders.length === 0) continue;

        const routesCount = Math.min(CREWS_PER_DAY * MAX_TRIPS, Math.ceil(dayOrders.length / MAX_STOPS_PER_ROUTE));
        const groups = splitByZone(DEPOT, dayOrders, routesCount);
        // Duplas y vehículos del día, rotando combinaciones. Si hay más rutas que duplas,
        // la misma dupla hace una segunda vuelta con el mismo vehículo.
        const drivers = shuffle(DRIVERS);
        const crews = Array.from({ length: CREWS_PER_DAY }, (_, i) =>
            rng() < 0.5 ? [drivers[2 * i], drivers[2 * i + 1]] : [drivers[2 * i + 1], drivers[2 * i]]);
        const vehicles = shuffle(VEHICLES).slice(0, CREWS_PER_DAY);
        const isPast = day < today;

        groups.forEach((group, index) => {
            const crewIndex = index % CREWS_PER_DAY;
            const [driver, coDriver] = crews[crewIndex];
            const createdAt = atAR(addDays(day, -1), randInt(15 * 60, 19 * 60));
            const route = {
                id: uuid(),
                day,
                driverId: driver.id,
                coDriverId: coDriver.id,
                vehicleId: vehicles[crewIndex].id,
                tripNumber: Math.floor(index / CREWS_PER_DAY) + 1,
                state: isPast ? "Completada" : "Pendiente",
                createdAt,
                // Una ruta completada se cerró a la tarde del día de reparto
                updatedAt: isPast ? atAR(day, randInt(13 * 60, 18 * 60)) : createdAt,
            };
            routes.push(route);

            orderStops(DEPOT, group).forEach((order, position) => {
                stops.push([uuid(), route.id, order.id, position + 1, isPast ? "Completada" : "Pendiente", createdAt]);
                if (isPast) order.updatedAt = route.updatedAt;
            });
        });
    }

    // --- SQL ---
    const out = [];
    out.push(`-- =====================================================================
-- Datos ficticios para el esquema de la v1.0. Generado por scripts/seed/generate-seed.mjs
-- el ${today}. NO editar a mano: cambiá el script y volvé a generarlo con
--   npm run seed:generate
-- Usuarios (contraseña para todos: ${DEV_PASSWORD}):
${people.map((person) => `--   ${person.role.padEnd(6)} ${person.email}`).join("\n")}
-- Historial: ${historyStart} a ${addDays(today, -1)} · hoy: rutas pendientes · pedidos hasta ${horizonEnd}
-- ${orders.length} pedidos, ${routes.length} rutas, ${stops.length} paradas
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

    out.push("-- Productos (los mismos que primer-admin-y-productos.sql: si ya están, no se duplican)");
    out.push(insert("public.products", ["id", "name", "description", "created_at"],
        PRODUCTS.map((product) => [product.id, product.name, product.description, PRODUCTS_CREATED_AT]))
        .replace(/;\n$/, "\nON CONFLICT (id) DO NOTHING;\n"));

    out.push("-- Clientes (coordenadas corregidas: ver COORDINATE_FIXES en el script)");
    out.push(insert("public.clients",
        ["id", "name", "email", "phone", "street", "number", "city", "province", "latitude", "longitude", "created_at", "is_active", "observations", "updated_at"],
        clients.map((client) => [client.id, client.name, client.email, client.phone, client.street, client.number, client.city, client.province,
            client.latitude, client.longitude, client.created_at, client.is_active, client.observations, client.updated_at])));

    out.push("-- Vehículos");
    out.push(insert("public.vehicles", ["id", "patent", "model", "is_active", "created_at"],
        VEHICLES.map((vehicle) => [vehicle.id, vehicle.patent, vehicle.model, true, "2026-08-05 23:30:00+00"])));

    out.push("-- Pedidos");
    out.push(insert("public.orders", ["id", "client_id", "arrival_date", "state", "created_at", "updated_at"],
        orders.map((order) => [order.id, order.clientId, `${order.day}T00:00:00Z`, order.state, order.createdAt, order.updatedAt])));
    out.push(insert("public.order_details", ["id", "order_id", "product_id", "quantity", "created_at"], orderDetails));

    out.push("-- Rutas (en orden cronológico: route_number sale de la identidad)");
    out.push(insert("public.routes",
        ["id", "driver_id", "co_driver_id", "vehicle_id", "route_date", "trip_number", "state", "created_at", "updated_at"],
        routes.map((route) => [route.id, route.driverId, route.coDriverId, route.vehicleId, `${route.day}T00:00:00Z`,
            route.tripNumber, route.state, route.createdAt, route.updatedAt])));
    out.push(insert("public.stops", ["id", "route_id", "order_id", "visit_order", "state", "created_at"], stops));

    out.push("COMMIT;\n");

    writeFileSync(OUTPUT, out.join("\n"));
    console.log(`Listo: ${OUTPUT}`);
    console.log(`${orders.length} pedidos (${orders.filter((o) => o.state === "Cancelada").length} cancelados), ${routes.length} rutas (${routes.filter((r) => r.tripNumber === 2).length} segundas vueltas), ${stops.length} paradas`);
}

main();
