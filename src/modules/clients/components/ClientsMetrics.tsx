// Styles
import styles from "./clients.module.css";

// Components
import Metric from "@/components/ui/admin/dashboard/metric/Metric";
import TopClientsChart from "./TopClientsChart";

// Types

import { Client } from "../clients.dal";

// Utils
import { getClientStatus } from "@/modules/clients/clients.utils";

// Icons
import { UserPlus, UserRoundCheck, UserRoundX, UserX } from "lucide-react";

// Props
type ClientsMetricsProps = {
    clients: Client[];
    topClients: { label: string; value: number }[] | null;
    // Habilitados sin pedidos en 30 días ni programados (null: no se pudo calcular)
    withoutRecentOrders: number | null;
};

export default function ClientsMetrics({ clients, topClients, withoutRecentOrders }: ClientsMetricsProps) {
    const totalClients = clients.length;
    // Misma regla que la tabla: sin is_active cargado cuenta como activo
    const activeClients = clients.filter(client => getClientStatus(client) === "Activo").length;
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
                    icon={<UserX size={15} />}
                    title="Sin pedidos en 30 días"
                    value={withoutRecentOrders ?? "—"}
                    description={
                        withoutRecentOrders
                            ? "Habilitados, sin pedidos recientes ni programados: contactalos"
                            : "Todos los habilitados pidieron en los últimos 30 días"
                    }
                />
                <Metric
                    icon={<UserRoundCheck size={15} />}
                    title="Clientes activos"
                    value={activeClients}
                    description="habilitados para recibir pedidos"
                />
                <Metric
                    icon={<UserRoundX size={15} />}
                    title="Clientes inactivos"
                    value={inactiveClients}
                    description="deshabilitados, no reciben pedidos"
                />
                <Metric
                    icon={<UserPlus size={15} />}
                    title="Clientes nuevos"
                    value={newClients}
                    description="en los últimos 60 días"
                />
            </div>
            <TopClientsChart clients={topClients ?? []} />
        </div>
    )
}