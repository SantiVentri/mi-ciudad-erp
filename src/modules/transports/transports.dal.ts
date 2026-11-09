import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'
import { getCurrentUser } from '@/utils/auth/getCurrentUser'
import { assertNoSupabaseError } from '@/utils/supabase/assertNoError'
import { todayKeyAR } from '@/utils/dates/argentina'
import { nextDayKey } from '@/modules/routes/routes.utils'
import { Driver } from './transports.types'

// Rutas de hoy en Argentina que siguen en pie (las canceladas no ocupan a nadie).
// route_date se guarda a medianoche UTC del día.
function todayRoutesQuery(supabase: Awaited<ReturnType<typeof getServerClient>>, columns: string) {
    const today = todayKeyAR()
    return supabase
        .from('routes')
        .select(columns)
        .gte('route_date', `${today}T00:00:00Z`)
        .lt('route_date', `${nextDayKey(today)}T00:00:00Z`)
        .neq('state', 'Cancelada')
}

export const getVehicles = cache(async () => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('vehicles')
        .select(`
            id,
            patent,
            model,
            km_per_liter,
            is_active,
            created_at
        `)
        .order('is_active', { ascending: false })
        .order('patent', { ascending: true })

    assertNoSupabaseError(error, 'Error trayendo los vehículos')

    return data
})

export type Vehicles = NonNullable<Awaited<ReturnType<typeof getVehicles>>>
export type Vehicle = Vehicles[number]

export const getDrivers = cache(async (): Promise<Driver[] | null> => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()
    if (!user) return null

    const { data: drivers, error } = await supabase.rpc('get_drivers')

    assertNoSupabaseError(error, 'Error trayendo los conductores')

    return drivers ?? []
})

export const getRouteAssignments = cache(async () => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('routes')
        .select('id, route_date, state, driver_id, vehicle_id')
        .order('route_date', { ascending: false })

    assertNoSupabaseError(error, 'Error trayendo las asignaciones de rutas')

    return data
})

export type RouteAssignments = NonNullable<Awaited<ReturnType<typeof getRouteAssignments>>>
export type RouteAssignment = RouteAssignments[number]

export const getVehiclesMetrics = cache(async () => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()
    if (!user) return null

    const [vehiclesRes, todayRoutesRes] = await Promise.all([
        supabase.from('vehicles').select('id, is_active, km_per_liter'),
        todayRoutesQuery(supabase, 'vehicle_id').returns<{ vehicle_id: string }[]>(),
    ])

    assertNoSupabaseError(vehiclesRes.error, 'Error trayendo métricas de vehículos')
    assertNoSupabaseError(todayRoutesRes.error, 'Error trayendo rutas de hoy')

    const vehicles = vehiclesRes.data ?? []
    const totalVehicles = vehicles.length
    // Mismo criterio que getVehicleStatus: is_active === false es lo único que cuenta como "Inactivo"
    const inactiveVehicles = vehicles.filter((v) => v.is_active === false).length
    const activeVehicles = totalVehicles - inactiveVehicles

    const assignedTodayIds = new Set((todayRoutesRes.data ?? []).map((r) => r.vehicle_id))
    const vehiclesWithoutRouteToday = vehicles.filter(
        (v) => v.is_active !== false && !assignedTodayIds.has(v.id)
    ).length

    // Sin rendimiento no se puede estimar el combustible de sus rutas
    const vehiclesWithoutYield = vehicles.filter(
        (v) => v.is_active !== false && v.km_per_liter == null
    ).length

    return {
        totalVehicles,
        activeVehicles,
        inactiveVehicles,
        vehiclesWithoutRouteToday,
        vehiclesWithoutYield,
    }
})

export type VehiclesMetricsData = NonNullable<Awaited<ReturnType<typeof getVehiclesMetrics>>>

export const getTopVehiclesByRoutes = cache(async (limit: number = 5) => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()
    if (!user) return null

    // Nota: cuenta TODAS las rutas asignadas al vehículo (no filtra por estado,
    // porque todavía no hay un valor confirmado de "completada" para routes.state).
    const { data, error } = await supabase
        .from('routes')
        .select('vehicle_id, vehicle:vehicles ( id, patent )')

    assertNoSupabaseError(error, 'Error trayendo el top de vehículos')

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

export const getDriversMetrics = cache(async () => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()
    if (!user) return null

    const drivers = await getDrivers()
    if (!drivers) return null

    const today = todayKeyAR()

    // Sueldos vigentes hoy: solo el admin los puede leer (RLS)
    const [todayRoutesRes, salariesRes] = await Promise.all([
        todayRoutesQuery(supabase, 'driver_id, co_driver_id').returns<
            { driver_id: string | null; co_driver_id: string | null }[]
        >(),
        user.role === 'admin'
            ? supabase
                  .from('salaries')
                  .select('profile_id')
                  .lte('valid_from', today)
                  .or(`valid_to.is.null,valid_to.gte.${today}`)
            : null,
    ])

    assertNoSupabaseError(todayRoutesRes.error, 'Error trayendo rutas de hoy')
    if (salariesRes) assertNoSupabaseError(salariesRes.error, 'Error trayendo los sueldos vigentes')

    const activeDriversList = drivers.filter((d) => d && d.is_active !== false)
    const totalDrivers = drivers.length
    const activeDrivers = activeDriversList.length

    // El acompañante también está ocupado
    const assignedTodayIds = new Set(
        (todayRoutesRes.data ?? []).flatMap((r) => [r.driver_id, r.co_driver_id]).filter(Boolean),
    )
    const driversWithoutRouteToday = activeDriversList.filter((d) => !assignedTodayIds.has(d.id)).length

    // Sin sueldo vigente no se puede estimar el costo laboral de sus rutas
    const withSalary = new Set((salariesRes?.data ?? []).map((s) => s.profile_id))
    const driversWithoutSalary = salariesRes
        ? activeDriversList.filter((d) => !withSalary.has(d.id)).length
        : null

    return {
        totalDrivers,
        activeDrivers,
        driversWithoutRouteToday,
        driversWithoutSalary,
    }
})

export type DriversMetricsData = NonNullable<Awaited<ReturnType<typeof getDriversMetrics>>>

export const getTopDriversByRoutes = cache(async (limit: number = 5) => {
    const supabase = await getServerClient()

    const user = await getCurrentUser()
    if (!user) return null

    // Nota: igual que con vehículos, cuenta TODAS las rutas asignadas
    // (no filtra por estado, porque no hay un valor confirmado de "completada" en routes.state).
    const [{ data: routes, error: routesError }, drivers] = await Promise.all([
        supabase.from('routes').select('driver_id'),
        getDrivers(),
    ])

    assertNoSupabaseError(routesError, 'Error trayendo el top de conductores')

    const nameByProfileId = new Map(
        (drivers ?? [])
            .filter((d) => d)
            .map((d) => {
                const fullName = `${d!.first_name ?? ''} ${d!.last_name ?? ''}`.trim()
                return [d!.id, fullName || d!.email] as const
            })
    )

    const counts = new Map<string, { label: string; value: number }>()

    for (const route of routes ?? []) {
        const driverId = route.driver_id
        const label = nameByProfileId.get(driverId) ?? 'Conductor eliminado'

        const existing = counts.get(driverId)
        if (existing) {
            existing.value += 1
        } else {
            counts.set(driverId, { label, value: 1 })
        }
    }

    return Array.from(counts.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
})

export type TopDriversByRoutes = NonNullable<Awaited<ReturnType<typeof getTopDriversByRoutes>>>