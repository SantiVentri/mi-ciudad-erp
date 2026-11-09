"use client";

// Styles
import styles from "./orders.module.css";

// Utils
import { dayKey, isSameDay } from "@/modules/orders/orders.utils";

// Constants and types
import { WEEKDAY_LABELS } from "@/modules/orders/orders.constants";
import type { Order } from "@/modules/orders/orders.dal";

type DayTabsProps = {
    days: Date[];
    selectedDay: Date;
    today: Date;
    ordersByDay: Map<string, Order[]>;
    // Vista "Todos": ningún día queda marcado
    isAllView: boolean;
    onSelectDay: (day: Date) => void;
    onSelectAll: () => void;
};

export default function DayTabs({
    days,
    selectedDay,
    today,
    ordersByDay,
    isAllView,
    onSelectDay,
    onSelectAll,
}: DayTabsProps) {
    return (
        <div className={styles.dayTabs}>
            <button
                type="button"
                className={[styles.dayTab, styles.dayTabAll, isAllView ? styles.dayTabActive : ""].join(" ")}
                onClick={onSelectAll}
                aria-pressed={isAllView}
                title="Ver todos los pedidos, de los más nuevos a los más viejos"
            >
                <span className={styles.dayTabWeekday}>Ver</span>
                <span className={styles.dayTabDate}>Todos</span>
            </button>

            {days.map((day) => {
                const key = dayKey(day);
                const count = ordersByDay.get(key)?.length ?? 0;
                const isSelected = !isAllView && isSameDay(day, selectedDay);
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
                        <span className={styles.dayTabWeekday}>{WEEKDAY_LABELS[day.getDay()]}</span>
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