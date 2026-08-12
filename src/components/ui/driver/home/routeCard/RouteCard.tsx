// Styles
import styles from "./routeCard.module.css";

// Components
import Link from "next/link";

// Types
import { Route } from "@/modules/routes/routes.dal";

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
                <span className={styles.state}>
                    {route.state}
                </span>
            </div>
        </Link>
    )
}