// Styles
import styles from "./route.module.css";

import RouteDetails from "@/components/ui/driver/home/routeDetails/RouteDetails";
import { getRoute } from "@/modules/routes/routes.dal";
import { getServerClient } from "@/utils/supabase/getServerClient";
import { redirect } from "next/navigation";

interface RoutePageProps {
    params: Promise<{
        routeId: string;
    }>;
}

export default async function RoutePage({ params }: RoutePageProps) {
    const { routeId } = await params;

    const supabase = await getServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!routeId) {
        redirect("/driver/routes");
    }

    const route = await getRoute(routeId);

    return (
        <div className={styles.container}>
            <RouteDetails route={route ? route : null} />
        </div>
    )
}