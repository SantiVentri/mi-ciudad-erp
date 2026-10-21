// Styles
import styles from "./routeCard.module.css";

// Components
import Link from "next/link";

// Types
import { Route } from "@/modules/routes/routes.dal";

// Color del badge según el estado de la ruta
const STATE_BADGE_STYLES: Record<string, string> = {
    Pendiente: styles.statePendiente,
    "En curso": styles.stateEnCurso,
    Completada: styles.stateCompletada,
    Cancelada: styles.stateCancelada,
};

export default function RouteCard({ route }: { route: Route }) {
    const date = new Date(route.routeDate);

    return (
        <Link href={`/driver/routes/${route.id}`} className={styles.container}>
            <div className={styles.date}>
                <span className={styles.number}>
                    {date.getDate()}
                </span>
                <span className={styles.month}>
                    {date.toLocaleString("default", { month: "short" })}
                </span>
            </div>
            <div className={styles.info}>
                <h3>Ruta N°{route.routeNumber}</h3>
                <p>N° de paradas: {route.stops.length}</p>
                <span className={`${styles.state} ${STATE_BADGE_STYLES[route.state ?? ""] ?? ""}`}>
                    {route.state}
                </span>
            </div>
        </Link>
    )
}