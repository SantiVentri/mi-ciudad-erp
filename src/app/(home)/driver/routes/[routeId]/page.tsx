// Styles
import styles from "./route.module.css";

import RouteDetails from "@/components/ui/driver/home/routeDetails/RouteDetails";
import { getRoute } from "@/modules/routes/routes.dal";
import { getRouteExpenses } from "@/modules/costs/costs.dal";
import { redirect } from "next/navigation";

interface RoutePageProps {
    params: Promise<{
        routeId: string;
    }>;
}

export default async function RoutePage({ params }: RoutePageProps) {
    const { routeId } = await params;

    if (!routeId) {
        redirect("/driver/routes");
    }

    const [route, expenses] = await Promise.all([getRoute(routeId), getRouteExpenses(routeId)]);

    return (
        <div className={styles.container}>
            <RouteDetails route={route ? route : null} expenses={route ? expenses : []} />
        </div>
    )
}