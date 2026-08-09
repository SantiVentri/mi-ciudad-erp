import styles from "@/modules/routes/components/routes.module.css";
import stopCardStyles from "@/components/ui/driver/home/stopCard/stopCard.module.css";

export const DAYS_BEFORE = 7;
export const DAYS_AFTER = 8;

export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Estados de ruta. routes.state arranca en "Pendiente" por defecto en la base.
export const ROUTE_STATE_OPTIONS = [
    "Todos",
    "Pendiente",
    "En curso",
    "Completada",
    "Cancelada",
];

export const ROUTE_STATE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    "En curso": styles.stateEnCurso,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
};

export const ADMIN_STOP_STATE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
};

export const MAP_TILE_URL =
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Vueltas posibles por día (la base solo admite 1 y 2)
export const TRIP_NUMBERS = [1, 2] as const;

// --- Conductor: ruta del día ---

export const STOP_STATE_STYLES: Record<string, string> = {
  Pendiente: stopCardStyles.statePendiente,
  Completada: stopCardStyles.stateCompletada,
};

export const DIRECCION_EMBOTELLADORA = process.env.NEXT_PUBLIC_COMPANY_ADDRESS;
