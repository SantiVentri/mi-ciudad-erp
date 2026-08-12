// Styles
import { Route } from "@/modules/routes/routes.dal";
import styles from "./routesList.module.css";
import RouteCard from "../routeCard/RouteCard";

export default function RoutesList({ routes }: { routes: Route[] | [] }) {
    return (
        <div className={styles.container}>
            {routes.length > 0 ? (
                routes.map((route) => (
                    <RouteCard key={route.id} route={route} />
                ))
            ) : (
                <p>No hay rutas para mostrar.</p>
            )}
        </div>
    )
}