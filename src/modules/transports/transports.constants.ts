import styles from "@/modules/transports/components/transports.module.css";

export const VEHICLE_STATUS_OPTIONS = ["Todos", "Activo", "Inactivo"];

// Topes del formulario de vehículo
export const MAX_VEHICLE_MODEL_LENGTH = 80;
export const MAX_KM_PER_LITER = 100;

export const VEHICLE_STATUS_STYLES: Record<string, string> = {
    Activo: styles.statusActivo,
    Inactivo: styles.statusInactivo,
};

export const DRIVER_STATUS_OPTIONS = ["Todos", "Activo", "Inactivo"];

export const DRIVER_STATUS_STYLES: Record<string, string> = {
    Activo: styles.statusActivo,
    Inactivo: styles.statusInactivo
};
