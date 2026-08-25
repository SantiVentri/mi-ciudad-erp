import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'
import { assertNoSupabaseError } from '@/utils/supabase/assertNoError'

export const getOrders = cache(async (startDate: string, endDate: string) => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
    .from('orders')
    .select(`
        id,
        arrival_date,
        state,
        created_at,
        client:clients ( id, name, email, phone, street, number, city, province ),
        order_details ( id, quantity, product:products ( id, name ) )
    `)
    .gte('arrival_date', startDate)
    .lte('arrival_date', endDate)
    .order('arrival_date', { ascending: true })

    assertNoSupabaseError(error, 'Error trayendo los pedidos')

    return data
})

export type Orders = NonNullable<Awaited<ReturnType<typeof getOrders>>>
export type Order = Orders[number]

export const getOrdersMetrics = cache(async () => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const thisYear = new Date().getFullYear()
    const yearStart = `${thisYear}-01-01`
    const yearEnd = `${thisYear + 1}-01-01`

    const baseQuery = () =>
        supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', yearStart)
            .lt('created_at', yearEnd)

    const [totalRes, completedRes, pendingRes, canceledRes] = await Promise.all([
        baseQuery(),
        baseQuery().eq('state', 'Completada'),
        baseQuery().eq('state', 'Pendiente'),
        baseQuery().eq('state', 'Cancelada'),
    ])

    for (const res of [totalRes, completedRes, pendingRes, canceledRes]) {
        assertNoSupabaseError(res.error, 'Error trayendo las métricas de pedidos')
    }

    const totalOrders = totalRes.count ?? 0
    const completedOrders = completedRes.count ?? 0
    const pendingOrders = pendingRes.count ?? 0
    const canceledOrders = canceledRes.count ?? 0
    const completedOrdersPercentage = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0

    return {
        totalOrders,
        completedOrders,
        pendingOrders,
        canceledOrders,
        completedOrdersPercentage,
    }
})

export type OrdersMetricsData = NonNullable<Awaited<ReturnType<typeof getOrdersMetrics>>>

export const getMonthlyOrdersGrowth = cache(async (months: number = 6) => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()
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