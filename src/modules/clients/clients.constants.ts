import styles from "@/modules/clients/components/clients.module.css";

export const STATUS_OPTIONS = ["Todos", "Activo", "Inactivo"];

export const STATUS_STYLES: Record<string, string> = {
    Activo: styles.statusActivo,
    Inactivo: styles.statusInactivo,
};

export const ORDER_STATE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
};