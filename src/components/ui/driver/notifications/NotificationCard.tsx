// Styles
import { Info } from "lucide-react";
import styles from "./notifications.module.css";

// Types
import { Notification } from "@/modules/notifications/notifications.dal";
import Link from "next/link";

function formatRelativeTime(dateInput: Date | string): string {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();

    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
        return "Just now";
    }

    if (diffInMinutes < 60) {
        return `${diffInMinutes}m${diffInMinutes === 1 ? "" : "s"} ago`;
    }

    if (diffInHours < 24) {
        return `${diffInHours}h${diffInHours === 1 ? "" : "s"} ago`;
    }

    return `${diffInDays}d${diffInDays === 1 ? "" : "s"} ago`;
}

export default function NotificationCard({ notification }: { notification: Notification }) {
    const notificationDate = formatRelativeTime(notification.created_at);

    return (
        <li>
            {notification.href ? (
                <Link href={notification.href} className={styles.notificationCard}>
                    <span>
                        <Info className={styles.icon} />
                    </span>
                    <div className={styles.notificationContent}>
                        <div className={styles.header}>
                            <h3>{notification.type}</h3>
                            <span className={styles.notificationDate}>{notificationDate}</span>
                        </div>
                        <p>{notification.message}</p>
                    </div>
                </Link>
            ) : (
                <div className={styles.notificationCard}>
                    <span>
                        <Info className={styles.icon} />
                    </span>
                    <div className={styles.notificationContent}>
                        <div className={styles.header}>
                            <h3>{notification.type}</h3>
                            <span className={styles.notificationDate}>{notificationDate}</span>
                        </div>
                        <p>{notification.message}</p>
                    </div>
                </div>
            )}
        </li>
    );
}