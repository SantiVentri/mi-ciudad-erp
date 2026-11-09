import styles from "@/modules/orders/components/orders.module.css";

export const DAYS_BEFORE = 7;
export const DAYS_AFTER = 8;

// Vista "Todos": todos los pedidos, de la fecha de entrega más lejana a la más vieja
export const ALL_ORDERS_VIEW = "todos";
export const ALL_ORDERS_PAGE_SIZE = 20;

// Pendiente = sin ruta; Asignada = en una ruta, todavía sin entregar
export const STATE_OPTIONS = ["Todos", "Pendiente", "Asignada", "Completada", "Cancelada"];

export const STATE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    Asignada: styles.stateAsignada,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
};

export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];