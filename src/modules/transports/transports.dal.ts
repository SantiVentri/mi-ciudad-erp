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

export const getVehiclesMetrics = cache(async () => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    const [vehiclesRes, todayRoutesRes] = await Promise.all([
        supabase.from('vehicles').select('id, is_active'),
        supabase
            .from('routes')
            .select('vehicle_id')
            .gte('route_date', todayStart.toISOString())
            .lt('route_date', tomorrowStart.toISOString()),
    ])

    if (vehiclesRes.error) {
        console.error('Error trayendo métricas de vehículos:', vehiclesRes.error.message)
    }
    if (todayRoutesRes.error) {
        console.error('Error trayendo rutas de hoy:', todayRoutesRes.error.message)
    }

    const vehicles = vehiclesRes.data ?? []
    const totalVehicles = vehicles.length
    // Mismo criterio que getVehicleStatus: is_active === false es lo único que cuenta como "Inactivo"
    const inactiveVehicles = vehicles.filter((v) => v.is_active === false).length
    const activeVehicles = totalVehicles - inactiveVehicles

    const assignedTodayIds = new Set((todayRoutesRes.data ?? []).map((r) => r.vehicle_id))
    const vehiclesWithoutRouteToday = vehicles.filter(
        (v) => v.is_active !== false && !assignedTodayIds.has(v.id)
    ).length

    return {
        totalVehicles,
        activeVehicles,
        inactiveVehicles,
        vehiclesWithoutRouteToday,
    }
})

export type VehiclesMetricsData = NonNullable<Awaited<ReturnType<typeof getVehiclesMetrics>>>

export const getTopVehiclesByRoutes = cache(async (limit: number = 5) => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Nota: cuenta TODAS las rutas asignadas al vehículo (no filtra por estado,
    // porque todavía no hay un valor confirmado de "completada" para routes.state).
    const { data, error } = await supabase
        .from('routes')
        .select('vehicle_id, vehicle:vehicles ( id, patent )')

    if (error) {
        console.error('Error trayendo el top de vehículos:', error.message)
        return null
    }

    const counts = new Map<string, { label: string; value: number }>()

    for (const route of data ?? []) {
        const vehicle = route.vehicle
        if (!vehicle) continue

        const existing = counts.get(vehicle.id)
        if (existing) {
            existing.value += 1
        } else {
            counts.set(vehicle.id, { label: vehicle.patent, value: 1 })
        }
    }

    return Array.from(counts.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
})

export type TopVehiclesByRoutes = NonNullable<Awaited<ReturnType<typeof getTopVehiclesByRoutes>>>