import styles from "@/components/ui/admin/transports/transports.module.css";

export const VEHICLE_STATUS_OPTIONS = ["Todos", "Activo", "Inactivo"];

export const VEHICLE_STATUS_STYLES: Record<string, string> = {
    Activo: styles.statusActivo,
    Inactivo: styles.statusInactivo,
};

export const DRIVER_STATUS_OPTIONS = ["Todos", "Activo", "Inactivo", "Invitación pendiente", "Invitación vencida"];

export const DRIVER_STATUS_STYLES: Record<string, string> = {
    Activo: styles.statusActivo,
    Inactivo: styles.statusInactivo,
    "Invitación pendiente": styles.statusPendiente,
    "Invitación vencida": styles.statusVencida,
};
