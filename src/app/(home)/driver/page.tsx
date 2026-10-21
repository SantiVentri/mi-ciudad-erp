// Styles
import styles from "./home.module.css";

// Components
import RoutesList from "@/components/ui/driver/home/routesList/RoutesList";

// Utils
import { getRoutes } from "@/modules/routes/routes.dal";
import { getCurrentUser } from "@/utils/auth/getCurrentUser";

export default async function DriverHomePage() {
    const [user, routes] = await Promise.all([getCurrentUser(), getRoutes()]);

    return (
        <div className={styles.container}>
            <header>
                <h1>Hola {user?.firstName}!</h1>
                <h3>Tus rutas asignadas:</h3>
            </header>
            <RoutesList routes={routes ?? []} />
        </div>
    )
}