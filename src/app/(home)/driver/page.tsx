// Styles
import styles from "./home.module.css";

// Components
import RoutesList from "@/components/ui/driver/home/routesList/RoutesList";

// Utils
import { getRoutes } from "@/modules/routes/routes.dal";
import { getServerClient } from "@/utils/supabase/getServerClient";

export default async function DriverHomePage() {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const routes = await getRoutes();

    return (
        <div className={styles.container}>
            <header>
                <h1>Hola {user?.user_metadata?.first_name}!</h1>
                <h3>Tus rutas asignadas:</h3>
            </header>
            <RoutesList routes={routes ?? []} />
        </div>
    )
}