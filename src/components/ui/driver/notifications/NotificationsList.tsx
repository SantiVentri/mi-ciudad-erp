"use client";

// Styles
import styles from "./notifications.module.css";

// Components
import NotificationCard from "./NotificationCard";

// Hooks
import { useState } from "react";

// Types
import { Notification } from "@/modules/notifications/notifications.dal";

export default function NotificationsList({ notifications }: { notifications: Notification[] }) {
    const [filter, setFilter] = useState<"Todos" | "Hoy" | "Esta semana">("Todos");

    const filteredNotifications = notifications.filter((notification) => {
        const notificationDate = new Date(notification.created_at);
        const today = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(today.getDate() - 7);

        if (filter === "Hoy") {
            return notificationDate.toDateString() === today.toDateString();
        } else if (filter === "Esta semana") {
            return notificationDate >= oneWeekAgo && notificationDate <= today;
        } else {
            return true;
        }
    });

    return (
        <div className={styles.listContainer}>
            <div className={styles.filters}>
                <button
                    className={filter === "Todos" ? styles.activeFilter : ""}
                    onClick={() => setFilter("Todos")}
                >
                    Todos
                </button>
                <button
                    className={filter === "Hoy" ? styles.activeFilter : ""}
                    onClick={() => setFilter("Hoy")}
                >
                    Hoy
                </button>
                <button
                    className={filter === "Esta semana" ? styles.activeFilter : ""}
                    onClick={() => setFilter("Esta semana")}
                >
                    Esta semana
                </button>
            </div>
            {filteredNotifications.length > 0 ? (
                <ul className={styles.notificationsList}>
                    {filteredNotifications.map((notification) => (
                        <NotificationCard key={notification.id} notification={notification} />
                    ))}
                </ul>
            ) : (
                <p>No hay notificaciones para mostrar.</p>
            )}
        </div>
    )
}