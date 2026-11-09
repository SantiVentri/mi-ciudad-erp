// Styles
import styles from "./vehiclesMetrics.module.css";

// Components
import Metric from "../../dashboard/metric/Metric";
import TopVehiclesChart from "./TopVehiclesChart";

// Types
import type { VehiclesMetricsData } from "@/modules/transports/transports.dal";

// Icons
import { Gauge, CheckCircle2, XCircle, MapPinOff } from "lucide-react";

type VehiclesMetricsProps = {
    metrics: VehiclesMetricsData | null;
    topVehicles: { label: string; value: number }[];
    onViewWithoutRouteToday?: () => void; // para el filtro clickable a futuro
};

export default function VehiclesMetrics({ metrics, topVehicles, onViewWithoutRouteToday }: VehiclesMetricsProps) {
    const vehiclesWithoutYield = metrics?.vehiclesWithoutYield ?? 0;
    const activeVehicles = metrics?.activeVehicles ?? 0;
    const inactiveVehicles = metrics?.inactiveVehicles ?? 0;
    const vehiclesWithoutRouteToday = metrics?.vehiclesWithoutRouteToday ?? 0;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Gauge size={15} />}
                    title="Sin rendimiento cargado"
                    value={vehiclesWithoutYield}
                    description={
                        vehiclesWithoutYield > 0
                            ? "Activos sin km por litro: no se estima el costo de sus rutas"
                            : "Todos los activos tienen rendimiento cargado"
                    }
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
                    className={styles.metricButton}
                    onClick={onViewWithoutRouteToday}
                    disabled={!onViewWithoutRouteToday}
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