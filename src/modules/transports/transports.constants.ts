import styles from "@/modules/transports/components/transports.module.css";

export const VEHICLE_STATUS_OPTIONS = ["Todos", "Activo", "Inactivo"];

export const VEHICLE_STATUS_STYLES: Record<string, string> = {
    Activo: styles.statusActivo,
    Inactivo: styles.statusInactivo,
};

export const DRIVER_STATUS_OPTIONS = ["Todos", "Activo", "Inactivo"];

export const DRIVER_STATUS_STYLES: Record<string, string> = {
    Activo: styles.statusActivo,
    Inactivo: styles.statusInactivo
};
