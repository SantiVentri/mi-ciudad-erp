import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'
import { getCurrentUser } from '@/utils/auth/getCurrentUser'
import { assertNoSupabaseError } from '@/utils/supabase/assertNoError'
import { todayKeyAR } from '@/utils/dates/argentina'

export const getOrders = cache(async (startDate: string, endDate: string) => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()

    if (!user) return null

    const { data, error } = await supabase
    .from('orders')
    .select(`
        id,
        arrival_date,
        state,
        created_at,
        client:clients ( id, name, email, phone, street, number, city, province ),
        order_details ( id, quantity, product:products ( id, name ) ),
        stops ( id, state, route:routes ( id, route_number, state ) )
    `)
    .gte('arrival_date', startDate)
    .lte('arrival_date', endDate)
    .order('arrival_date', { ascending: true })

    assertNoSupabaseError(error, 'Error trayendo los pedidos')

    return data
})

export type Orders = NonNullable<Awaited<ReturnType<typeof getOrders>>>
export type Order = Orders[number]

// Fechas "YYYY-MM-DD" (los pedidos se guardan a medianoche UTC del día de entrega)
function shiftDayKey(key: string, days: number) {
    const [year, month, day] = key.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function firstOfMonthKey(key: string, monthsBack = 0) {
    const [year, month] = key.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1 - monthsBack, 1)).toISOString().slice(0, 10)
}

// Ventas de los pedidos completados con entrega en [start, end): cantidad × precio guardado
// en cada renglón. Pagina de a 1000 filas (tope de PostgREST).
async function getCompletedSales(
    supabase: Awaited<ReturnType<typeof getServerClient>>,
    start: string,
    end: string,
) {
    const PAGE = 1000
    let total = 0
    let unpricedLines = 0
    const pricedOrders = new Set<string>()

    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('order_details')
            .select('id, order_id, quantity, unit_price, orders!inner ( state, arrival_date )')
            .eq('orders.state', 'Completada')
            .gte('orders.arrival_date', start)
            .lt('orders.arrival_date', end)
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1)

        assertNoSupabaseError(error, 'Error trayendo las ventas')

        for (const line of data ?? []) {
            if (line.unit_price == null) {
                unpricedLines += 1
                continue
            }
            total += Number(line.quantity) * Number(line.unit_price)
            pricedOrders.add(line.order_id)
        }

        if (!data || data.length < PAGE) break
    }

    return { total, orders: pricedOrders.size, unpricedLines }
}

// Solo admin: incluye montos de venta
export const getOrdersMetrics = cache(async () => {
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') return null

    const supabase = await getServerClient()

    const today = todayKeyAR()
    const tomorrow = shiftDayKey(today, 1)
    const monthStart = firstOfMonthKey(today)

    // Mismo tramo del mes anterior: del 1 al mismo día (sin pasarse del fin de ese mes)
    const previousStart = firstOfMonthKey(today, 1)
    const dayOfMonth = Number(today.slice(8, 10))
    const shiftedEnd = shiftDayKey(previousStart, dayOfMonth)
    const previousEnd = shiftedEnd < monthStart ? shiftedEnd : monthStart

    // Cumplimiento: pedidos con entrega en los últimos 30 días, sin contar hoy
    const deliveryStart = shiftDayKey(today, -30)

    const countOrders = () =>
        supabase.from('orders').select('id', { count: 'exact', head: true })

    const [sales, previousSales, dueRes, deliveredRes, canceledRes, overdueRes] = await Promise.all([
        getCompletedSales(supabase, monthStart, tomorrow),
        getCompletedSales(supabase, previousStart, previousEnd),
        countOrders().gte('arrival_date', deliveryStart).lt('arrival_date', today).neq('state', 'Cancelada'),
        countOrders().gte('arrival_date', deliveryStart).lt('arrival_date', today).eq('state', 'Completada'),
        countOrders().gte('arrival_date', deliveryStart).lt('arrival_date', today).eq('state', 'Cancelada'),
        // Atrasados: la fecha ya pasó y no se entregaron (sin ruta o en una ruta sin completar)
        countOrders().lt('arrival_date', today).in('state', ['Pendiente', 'Asignada']),
    ])

    for (const res of [dueRes, deliveredRes, canceledRes, overdueRes]) {
        assertNoSupabaseError(res.error, 'Error trayendo las métricas de pedidos')
    }

    const dueOrders = dueRes.count ?? 0
    const deliveredOrders = deliveredRes.count ?? 0

    return {
        monthSales: sales.total,
        monthSalesOrders: sales.orders,
        unpricedLines: sales.unpricedLines,
        avgTicket: sales.orders > 0 ? sales.total / sales.orders : null,
        previousSales: previousSales.total,
        previousMonthStart: previousStart,
        salesChangePct:
            previousSales.total > 0 ? ((sales.total - previousSales.total) / previousSales.total) * 100 : null,
        deliveryRate: dueOrders > 0 ? (deliveredOrders / dueOrders) * 100 : null,
        deliveredOrders,
        dueOrders,
        canceledOrders: canceledRes.count ?? 0,
        overdueOrders: overdueRes.count ?? 0,
    }
})

export type OrdersMetricsData = NonNullable<Awaited<ReturnType<typeof getOrdersMetrics>>>

export const getMonthlyOrdersGrowth = cache(async (months: number = 6) => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()
    if (!user) return null

    const today = new Date()

    const buckets: { key: string; label: string; start: Date; end: Date; value: number }[] = []
    for (let i = months - 1; i >= 0; i--) {
        const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1)
        const key = `${start.getFullYear()}-${start.getMonth()}`
        const rawLabel = start.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
        const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
        buckets.push({ key, label, start, end, value: 0 })
    }

    const results = await Promise.all(
        buckets.map((bucket) =>
            supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .gte('arrival_date', bucket.start.toISOString())
                .lt('arrival_date', bucket.end.toISOString()),
        ),
    )

    results.forEach((res, i) => {
        assertNoSupabaseError(res.error, 'Error trayendo el crecimiento mensual de pedidos')
        buckets[i].value = res.count ?? 0
    })

    return buckets.map(({ label, value }) => ({ label, value }))
})

export type MonthlyOrdersGrowth = NonNullable<Awaited<ReturnType<typeof getMonthlyOrdersGrowth>>>

// Clientes activos y productos habilitados (con su stock) para el formulario de nuevo pedido
export const getNewOrderOptions = cache(async () => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()
    if (!user) return null

    const [clientsRes, productsRes] = await Promise.all([
        supabase
            .from('clients')
            .select('id, name, street, number, city')
            .or('is_active.is.null,is_active.eq.true')
            .order('name', { ascending: true }),
        // Solo los que se pueden pedir: habilitados y no eliminados
        supabase
            .from('products')
            .select('id, name, stock')
            .eq('is_active', true)
            .is('archived_at', null)
            .order('name', { ascending: true }),
    ])

    assertNoSupabaseError(clientsRes.error, 'Error trayendo los clientes')
    assertNoSupabaseError(productsRes.error, 'Error trayendo los productos')

    return {
        clients: clientsRes.data ?? [],
        products: productsRes.data ?? [],
    }
})

export type NewOrderOptions = NonNullable<Awaited<ReturnType<typeof getNewOrderOptions>>>
