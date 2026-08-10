// Styles
import styles from "./notifications.module.css";

// Types
import { Notification } from "@/modules/notifications/notifications.dal";

export default function NotificationCard({ notification }: { notification: Notification }) {
    return (
        <li className={styles.notificationCard}>
            <div className={styles.notificationContent}>
                <h3>{notification.type}</h3>
                <p>{notification.message}</p>
                <span className={styles.notificationDate}>{new Date(notification.created_at).toLocaleString()}</span>
            </div>
        </li>
    )
}