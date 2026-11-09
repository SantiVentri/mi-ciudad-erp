import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'
import { getCurrentUser } from '@/utils/auth/getCurrentUser'
import { assertNoSupabaseError } from '@/utils/supabase/assertNoError'
import { todayKeyAR } from '@/utils/dates/argentina'
import { getClientStatus } from '@/modules/clients/clients.utils'

// PostgREST devuelve como mucho 1000 filas por consulta: se pide de a páginas
const PAGE_SIZE = 1000

// client_id de los pedidos no cancelados (opcionalmente, con entrega desde una fecha)
async function getOrderClientIds(
    supabase: Awaited<ReturnType<typeof getServerClient>>,
    fromDate?: string,
) {
    const clientIds: string[] = []

    for (let from = 0; ; from += PAGE_SIZE) {
        let query = supabase
            .from('orders')
            .select('id, client_id')
            .neq('state', 'Cancelada')
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1)
        if (fromDate) query = query.gte('arrival_date', fromDate)

        const { data, error } = await query
        assertNoSupabaseError(error, 'Error trayendo los pedidos de los clientes')

        for (const order of data ?? []) clientIds.push(order.client_id)
        if (!data || data.length < PAGE_SIZE) break
    }

    return clientIds
}

export const getClients = cache(async () => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('clients')
        .select(`
            id,
            name,
            email,
            phone,
            street,
            number,
            city,
            province,
            is_active,
            created_at
        `)
        .order('is_active', {ascending: false})
        .order('name', { ascending: true })

    assertNoSupabaseError(error, 'Error trayendo los clientes')

    return data
})

export type Clients = NonNullable<Awaited<ReturnType<typeof getClients>>>
export type Client = Clients[number]

export async function getClientOrders(clientId: string) {
    const supabase = await getServerClient()

    const user = await getCurrentUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('orders')
        .select(`
            id,
            arrival_date,
            state,
            order_details ( id, quantity, product:products ( id, name ) )
        `)
        .eq('client_id', clientId)
        .order('arrival_date', { ascending: false })

    assertNoSupabaseError(error, 'Error trayendo el historial del cliente')

    return data
}

export type ClientOrders = NonNullable<Awaited<ReturnType<typeof getClientOrders>>>
export type ClientOrder = ClientOrders[number]

export const getTopClientsByOrders = cache(async (limit: number = 3) => {
    const user = await getCurrentUser()
    if (!user) return null

    const [clients, clientIds] = await Promise.all([
        getClients(),
        getOrderClientIds(await getServerClient()),
    ])

    const names = new Map((clients ?? []).map((client) => [client.id, client.name]))
    const counts = new Map<string, number>()
    for (const clientId of clientIds) counts.set(clientId, (counts.get(clientId) ?? 0) + 1)

    return Array.from(counts, ([clientId, value]) => ({ label: names.get(clientId), value }))
        .filter((entry): entry is { label: string; value: number } => entry.label != null)
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
})

// Clientes habilitados sin pedidos en los últimos 30 días ni programados para adelante
export const getClientsWithoutRecentOrders = cache(async () => {
    const user = await getCurrentUser()
    if (!user) return null

    const [year, month, day] = todayKeyAR().split('-').map(Number)
    const since = new Date(Date.UTC(year, month - 1, day - 30)).toISOString().slice(0, 10)

    const [clients, recentClientIds] = await Promise.all([
        getClients(),
        getOrderClientIds(await getServerClient(), since),
    ])

    const recent = new Set(recentClientIds)
    return (clients ?? []).filter(
        (client) => getClientStatus(client) === 'Activo' && !recent.has(client.id),
    ).length
})

export type TopClientsByOrders = NonNullable<Awaited<ReturnType<typeof getTopClientsByOrders>>>