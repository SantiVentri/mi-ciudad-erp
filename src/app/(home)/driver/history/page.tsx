// Styles
import styles from "./history.module.css";

import RoutesList from "@/components/ui/driver/home/routesList/RoutesList";
import { getPreviousRoutes } from "@/modules/routes/routes.dal";

export default async function DriverHistoryPage() {
    const previousRoutes = await getPreviousRoutes();
    return (
        <div className={styles.container}>
            <header>
                <h1>Tus rutas pasadas:</h1>
                <p>Aquí puedes ver un historial de todas las rutas que te han asignado anteriormente.</p>
            </header>
            <RoutesList routes={previousRoutes ?? []} />
        </div>
    )
}