// Styles
import styles from "./home.module.css";

// Components
import RouteDetails from "@/components/ui/driver/home/routeDetails/RouteDetails";

// DAL
import { getCurrentRoute } from "@/modules/routes/routes.dal";

// Utils
import { getServerClient } from "@/utils/supabase/getServerClient";

export default async function DriverHomePage() {
    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const currentRoute = await getCurrentRoute();

    return (
        <div className={styles.container}>
            <header>
                <h1>Hola {user?.user_metadata?.first_name}!</h1>
                <h3>Tu ruta de hoy:</h3>
            </header>
            <RouteDetails currentRoute={currentRoute ? currentRoute : null} />
        </div>
    )
}