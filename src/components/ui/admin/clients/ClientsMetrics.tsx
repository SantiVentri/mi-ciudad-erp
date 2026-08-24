// Styles
import styles from "./clients.module.css";

// Components
import Metric from "../dashboard/metric/Metric";

// Types
import type { Client } from "../../../../modules/clients/clients.dal";

// Icons
import { Users } from "lucide-react";
import TopClientsChart from "./TopClientsChart";

// Props
type ClientsMetricsProps = {
    clients: Client[];
    topClients: { label: string; value: number }[] | null;
};

export default function ClientsMetrics({ clients, topClients }: ClientsMetricsProps) {
    const totalClients = clients.length;
    const activeClients = clients.filter(client => client.is_active).length;
    const inactiveClients = totalClients - activeClients;

    const isNew = (createdAt: string) => {
        const createdDate = new Date(createdAt);
        const now = new Date();
        const diffInDays = (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
        return diffInDays <= 60;
    }

    const newClients = clients.filter(client => isNew(client.created_at)).length;

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Users size={15} />}
                    title="Total de clientes"
                    value={totalClients}
                    description="en toda la base"
                />
                <Metric
                    icon={<Users size={15} />}
                    title="Clientes activos"
                    value={activeClients}
                    description="con actividad reciente"
                />
                <Metric
                    icon={<Users size={15} />}
                    title="Clientes inactivos"
                    value={inactiveClients}
                    description="sin actividad reciente"
                />
                <Metric
                    icon={<Users size={15} />}
                    title="Clientes nuevos"
                    value={inactiveClients}
                    description="en los últimos 60 días"
                />
            </div>
            <TopClientsChart clients={topClients ?? []} />
        </div>
    )
}