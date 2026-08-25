// Styles
import styles from "./driversMetrics.module.css";

// Components
import Metric from "../../dashboard/metric/Metric";
import TopDriversChart from "./TopDriversChart";

// Types
import type { DriversMetricsData } from "@/modules/transports/transports.dal";

// Icons
import { Users, UserCheck, Clock, MapPinOff } from "lucide-react";

type DriversMetricsProps = {
    metrics: DriversMetricsData | null;
    topDrivers: { label: string; value: number }[];
    onViewWithoutRouteToday?: () => void; // para el filtro clickable a futuro
};

export default function DriversMetrics({ metrics, topDrivers, onViewWithoutRouteToday }: DriversMetricsProps) {
    const totalDrivers = metrics?.totalDrivers ?? 0;
    const activeDrivers = metrics?.activeDrivers ?? 0;
    const driversWithoutRouteToday = metrics?.driversWithoutRouteToday ?? 0;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Users size={15} />}
                    title="Total de conductores"
                    value={totalDrivers}
                    description="entre activos e invitados"
                />
                <Metric
                    icon={<UserCheck size={15} />}
                    title="Conductores activos"
                    value={activeDrivers}
                    description="con cuenta registrada"
                />
                <button
                    type="button"
                    onClick={onViewWithoutRouteToday}
                    disabled={!onViewWithoutRouteToday}
                    style={{
                        all: "unset",
                        cursor: onViewWithoutRouteToday ? "pointer" : "default",
                    }}
                >
                    <Metric
                        icon={<MapPinOff size={15} />}
                        title="Sin ruta asignada hoy"
                        value={driversWithoutRouteToday}
                        description="de los conductores activos"
                    />
                </button>
            </div>
            <TopDriversChart drivers={topDrivers} />
        </div>
    )
}