import { getServerClient } from "../supabase/getServerClient";
import { getCurrentUser } from "./getCurrentUser";

export default async function requireRole(role: string) {
    const user = await getCurrentUser();

    if (!user || user.role !== role) {
        return null;
    }

    return getServerClient();
}
