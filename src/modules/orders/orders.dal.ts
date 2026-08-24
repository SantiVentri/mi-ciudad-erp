import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'

export const getOrders = cache(async () => {
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
    .order('arrival_date', { ascending: true })

    
    if (error) {
        console.error('Error trayendo los pedidos:', error.message)
    }
    
    return data
})

export type Orders = NonNullable<Awaited<ReturnType<typeof getOrders>>>
export type Order = Orders[number]

export const getMonthlyOrdersGrowth = cache(async (months: number = 6) => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1)

    const { data, error } = await supabase
        .from('orders')
        .select('arrival_date')
        .gte('arrival_date', startDate.toISOString())

    if (error) {
        console.error('Error trayendo el crecimiento mensual de pedidos:', error.message)
        return null
    }

    const buckets: { key: string; label: string; value: number }[] = []
    for (let i = months - 1; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        const rawLabel = date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
        const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
        buckets.push({ key, label, value: 0 })
    }

    const bucketMap = new Map(buckets.map((b) => [b.key, b]))

    for (const order of data ?? []) {
        if (!order.arrival_date) continue
        const d = new Date(order.arrival_date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        const bucket = bucketMap.get(key)
        if (bucket) bucket.value += 1
    }

    return buckets.map(({ label, value }) => ({ label, value }))
})

export type MonthlyOrdersGrowth = NonNullable<Awaited<ReturnType<typeof getMonthlyOrdersGrowth>>>