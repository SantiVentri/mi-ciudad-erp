import styles from "@/modules/orders/components/orders.module.css";

export const DAYS_BEFORE = 7;
export const DAYS_AFTER = 8;

// Pendiente = sin ruta; Asignada = en una ruta, todavía sin entregar
export const STATE_OPTIONS = ["Todos", "Pendiente", "Asignada", "Completada", "Cancelada"];

export const STATE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    Asignada: styles.stateAsignada,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
};

export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];