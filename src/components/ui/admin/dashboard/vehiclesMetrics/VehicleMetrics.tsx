// Styles
import styles from "./vehiclesMetrics.module.css";

// Components
import Metric from "../../dashboard/metric/Metric";
import TopVehiclesChart from "./TopVehiclesChart";

// Types
import type { VehiclesMetricsData } from "@/modules/transports/transports.dal";

// Icons
import { Truck, CheckCircle2, XCircle, MapPinOff } from "lucide-react";

type VehiclesMetricsProps = {
    metrics: VehiclesMetricsData | null;
    topVehicles: { label: string; value: number }[];
    onViewWithoutRouteToday?: () => void; // para el filtro clickable a futuro
};

export default function VehiclesMetrics({ metrics, topVehicles, onViewWithoutRouteToday }: VehiclesMetricsProps) {
    const totalVehicles = metrics?.totalVehicles ?? 0;
    const activeVehicles = metrics?.activeVehicles ?? 0;
    const inactiveVehicles = metrics?.inactiveVehicles ?? 0;
    const vehiclesWithoutRouteToday = metrics?.vehiclesWithoutRouteToday ?? 0;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Truck size={15} />}
                    title="Total de vehículos"
                    value={totalVehicles}
                    description="en toda la flota"
                />
                <Metric
                    icon={<CheckCircle2 size={15} />}
                    title="Vehículos activos"
                    value={activeVehicles}
                    description="disponibles para operar"
                />
                <Metric
                    icon={<XCircle size={15} />}
                    title="Vehículos inactivos"
                    value={inactiveVehicles}
                    description="dados de baja"
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
                        value={vehiclesWithoutRouteToday}
                        description="de la flota activa"
                    />
                </button>
            </div>
            <TopVehiclesChart vehicles={topVehicles} />
        </div>
    )
}