import { getServerClient } from "@/utils/supabase/getServerClient"

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    message: string;
    href: string;
    seen: boolean;
    created_at: string;
}

export const getNotifications = async (userId: string) => {
    const supabase = await getServerClient();

    const {data, error} = await supabase
    .from("notifications")
    .select(`
        id,
        user_id,
        type,
        message,
        href,
        seen,
        created_at
    `)
    .eq("user_id", userId)
    .order("created_at", {ascending: false});

    if (error) {
        console.error("Error trayendo las notificaciones del conductor. ", error);
        return [];
    }

    return data ?? [];
}