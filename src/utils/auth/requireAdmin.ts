import { getServerClient } from "../supabase/getServerClient";
import { getCurrentUser } from "./getCurrentUser";

export default async function requireAdmin() {
    const user = await getCurrentUser();

    if (!user || user.role !== "admin") {
        return null;
    }

    return getServerClient();
}
