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