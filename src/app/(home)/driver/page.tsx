// Styles
import { getCurrentRoute } from "@/modules/routes/routes.dal";
import styles from "./home.module.css";

// Components
import RouteDetails from "@/components/ui/driver/home/routeDetails/RouteDetails";

export default async function DriverHomePage() {
    const currentRoute = await getCurrentRoute();

    return (
        <div className={styles.container}>
            <RouteDetails currentRoute={currentRoute ? currentRoute : null} />
        </div>
    )
}