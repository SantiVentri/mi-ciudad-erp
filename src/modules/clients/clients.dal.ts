import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'
import { assertNoSupabaseError } from '@/utils/supabase/assertNoError'

export const getClients = cache(async () => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()

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

    const { data: { user } } = await supabase.auth.getUser()

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
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('orders')
        .select(`
            client_id,
            client:clients ( id, name )
        `)

    assertNoSupabaseError(error, 'Error trayendo el top de clientes')

    const counts = new Map<string, { label: string; value: number }>()

    for (const order of data ?? []) {
        const client = order.client
        if (!client) continue

        const existing = counts.get(client.id)
        if (existing) {
            existing.value += 1
        } else {
            counts.set(client.id, { label: client.name, value: 1 })
        }
    }

    return Array.from(counts.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
})

export type TopClientsByOrders = NonNullable<Awaited<ReturnType<typeof getTopClientsByOrders>>>