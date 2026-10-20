"use client";

// Styles
import styles from "./routes.module.css";

// Utils
import { dayKey, isSameDay } from "@/modules/orders/orders.utils";

// Constants and types
import { WEEKDAY_LABELS } from "@/modules/routes/routes.constants";
import type { DayOrdersStatus } from "@/modules/routes/routes.types";

// Icons
import { Check } from "lucide-react";

type RouteDayTabsProps = {
    days: Date[];
    selectedDay: Date;
    today: Date;
    ordersByDay: Record<string, DayOrdersStatus>;
    onSelectDay: (day: Date) => void;
};

export default function RouteDayTabs({
    days,
    selectedDay,
    today,
    ordersByDay,
    onSelectDay,
}: RouteDayTabsProps) {
    return (
        <div className={styles.dayTabs}>
            {days.map((day) => {
                const key = dayKey(day);
                const status = ordersByDay[key];
                const isSelected = isSameDay(day, selectedDay);
                const isToday = isSameDay(day, today);

                return (
                    <button
                        key={key}
                        type="button"
                        className={[
                            styles.dayTab,
                            isSelected ? styles.dayTabActive : "",
                            isToday ? styles.dayTabToday : "",
                        ].join(" ")}
                        onClick={() => onSelectDay(day)}
                        title={
                            status
                                ? status.pending > 0
                                    ? `${status.pending} ${status.pending === 1 ? "pedido pendiente" : "pedidos pendientes"} de asignar`
                                    : "Todos los pedidos del día tienen ruta o están cerrados"
                                : "Sin pedidos"
                        }
                    >
                        <span className={styles.dayTabWeekday}>
                            {WEEKDAY_LABELS[day.getDay()]}
                        </span>
                        <span className={styles.dayTabDate}>
                            {day.getDate()}/{day.getMonth() + 1}
                        </span>
                        {/* Pendientes de asignar; tick si el día tiene pedidos y ninguno quedó pendiente */}
                        {status &&
                            (status.pending > 0 ? (
                                <span className={`${styles.dayTabCount} ${styles.dayTabPending}`}>
                                    {status.pending}
                                </span>
                            ) : (
                                <span className={`${styles.dayTabCount} ${styles.dayTabDone}`}>
                                    <Check size={12} strokeWidth={3} />
                                </span>
                            ))}
                    </button>
                );
            })}
        </div>
    );
}
