// Títulos de cada tipo de notificación (notifications.type lo guardan las funciones de la base)
export const NOTIFICATION_TITLES: Record<string, string> = {
    route_assigned: "Ruta asignada",
    route_updated: "Ruta modificada",
    route_unassigned: "Ya no estás en la ruta",
    route_cancelled: "Ruta cancelada",
    route_deleted: "Ruta eliminada",
};

// Si aparece un tipo nuevo sin título, se muestra "Aviso" en vez del código interno
export function getNotificationTitle(type: string) {
    return NOTIFICATION_TITLES[type] ?? "Aviso";
}
