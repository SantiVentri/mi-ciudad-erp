import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'

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

    if (error) {
        console.error('Error trayendo los clientes:', error.message)
    }

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

    if (error) {
        console.error('Error trayendo el historial del cliente:', error.message)
    }

    return data
}

export type ClientOrders = NonNullable<Awaited<ReturnType<typeof getClientOrders>>>
export type ClientOrder = ClientOrders[number]