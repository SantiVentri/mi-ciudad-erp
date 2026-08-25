import { getServerClient } from "../supabase/getServerClient";

export default async function requireRole(role: string) {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.app_metadata?.role !== role) {
        return null;
    }

    return supabase;
}