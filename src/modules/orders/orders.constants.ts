import styles from "@/modules/orders/components/orders.module.css";

export const DAYS_BEFORE = 7;
export const DAYS_AFTER = 8;

export const STATE_OPTIONS = ["Todos", "Pendiente", "Completada", "Cancelada"];

export const STATE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
};

export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];