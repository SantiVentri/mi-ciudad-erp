// Styles
import styles from "./notifications.module.css";

// Components
import NotificationsList from "@/components/ui/driver/notifications/NotificationsList";
import { redirect } from "next/navigation";

// Utils
import { getServerClient } from "@/utils/supabase/getServerClient";
import { getNotifications } from "@/modules/notifications/notifications.dal";

export default async function DriverNotificationsPage() {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/driver/login");
    }

    const notifications = await getNotifications(user.id);

    return (
        <div className={styles.container}>
            <header>
                <h1>Notificaciones</h1>
            </header>
            <NotificationsList notifications={notifications || []} />
        </div>
    )
}