import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'

// Usuario logueado, una sola vez por request (cache de React).
// getClaims() valida el JWT de la cookie localmente (con claves asimétricas no
// hace un viaje al servidor de Auth, a diferencia de getUser()).
export const getCurrentUser = cache(async () => {
    const supabase = await getServerClient()

    const { data, error } = await supabase.auth.getClaims()
    if (error || !data) return null

    const { claims } = data

    return {
        id: claims.sub,
        email: claims.email,
        role: claims.app_metadata?.role as string | undefined,
        firstName: claims.user_metadata?.first_name as string | undefined,
    }
})

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
