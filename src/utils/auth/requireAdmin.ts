import { getServerClient } from "../supabase/getServerClient";

export default async function requireAdmin() {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.app_metadata?.role !== "admin") {
        return null;
    }

    return supabase;
}