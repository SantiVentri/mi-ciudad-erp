import 'server-only'
import { cookies } from 'next/headers'
import { createClient } from './server'

export async function getServerClient() {
    const cookieStore = await cookies()
    return createClient(cookieStore)
}