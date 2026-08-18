import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'

export const getVehicles = cache(async () => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('vehicles')
        .select(`
            id,
            patent,
            is_active,
            created_at
        `)
        .order('is_active', { ascending: false })
        .order('patent', { ascending: true })

    if (error) {
        console.error('Error trayendo los vehículos:', error.message)
    }

    return data
})

export type Vehicles = NonNullable<Awaited<ReturnType<typeof getVehicles>>>
export type Vehicle = Vehicles[number]

export const getDrivers = cache(async () => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: invitations, error: invitationsError } = await supabase
        .from('invitations')
        .select('id, email, created_at, expires_at, used_at')
        .eq('role', 'driver')
        .order('created_at', { ascending: false })

    if (invitationsError) {
        console.error('Error trayendo las invitaciones de conductores:', invitationsError.message)
        return []
    }

    const emails = (invitations ?? []).map((invitation) => invitation.email)

    const { data: profiles, error: profilesError } = emails.length
        ? await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone, avatar, is_active')
            .in('email', emails)
        : { data: [], error: null }

    if (profilesError) {
        console.error('Error trayendo los perfiles de conductores:', profilesError.message)
    }

    const profileByEmail = new Map((profiles ?? []).map((profile) => [profile.email, profile]))

    return (invitations ?? []).map((invitation) => ({
        ...invitation,
        profile: profileByEmail.get(invitation.email) ?? null,
    }))
})

export type Drivers = NonNullable<Awaited<ReturnType<typeof getDrivers>>>
export type Driver = Drivers[number]

export const getRouteAssignments = cache(async () => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('routes')
        .select('id, route_date, state, driver_id, vehicle_id')
        .order('route_date', { ascending: false })

    if (error) {
        console.error('Error trayendo las asignaciones de rutas:', error.message)
    }

    return data
})

export type RouteAssignments = NonNullable<Awaited<ReturnType<typeof getRouteAssignments>>>
export type RouteAssignment = RouteAssignments[number]
