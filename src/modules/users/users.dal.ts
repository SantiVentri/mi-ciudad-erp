import 'server-only'
import { cache } from 'react'
import { getServerClient } from '@/utils/supabase/getServerClient'

export const getProfile = cache(async () => {
    const supabase = await getServerClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name, avatar')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('Error trayendo el perfil:', error.message)
    }

    const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim()

    return {
        name: fullName || 'Usuario',
        email: user.email ?? '',
        avatarUrl: profile?.avatar,
    }
})

export type CurrentUser = Awaited<ReturnType<typeof getProfile>>