"use client";

// Styles
import styles from "./routes.module.css";

// Utils
import { dayKey, isSameDay } from "@/modules/orders/orders.utils";

// Constants and types
import { WEEKDAY_LABELS } from "@/modules/routes/routes.constants";
import type { AdminRoute } from "@/modules/routes/routes.dal";

type RouteDayTabsProps = {
    days: Date[];
    selectedDay: Date;
    today: Date;
    routesByDay: Map<string, AdminRoute[]>;
    onSelectDay: (day: Date) => void;
};

export default function RouteDayTabs({
    days,
    selectedDay,
    today,
    routesByDay,
    onSelectDay,
}: RouteDayTabsProps) {
    return (
        <div className={styles.dayTabs}>
            {days.map((day) => {
                const key = dayKey(day);
                const count = routesByDay.get(key)?.length ?? 0;
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
                    >
                        <span className={styles.dayTabWeekday}>
                            {WEEKDAY_LABELS[day.getDay()]}
                        </span>
                        <span className={styles.dayTabDate}>
                            {day.getDate()}/{day.getMonth() + 1}
                        </span>
                        {count > 0 && <span className={styles.dayTabCount}>{count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
