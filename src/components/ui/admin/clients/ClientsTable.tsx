"use client";

// Styles
import styles from "./clients.module.css";

// Utils and constants
import { getClientStatus } from "@/modules/clients/clients.utils";
import { STATUS_STYLES } from "@/modules/clients/clients.constants";

// Types
import type { Client } from "@/modules/clients/clients.dal";

// Icons
import { Clock, PencilLine, RotateCcw, Trash2 } from "lucide-react";

type ClientsTableProps = {
    clients: Client[];
    isRestoring: (client: Client) => boolean;
    onEdit: (client: Client) => void;
    onDelete: (client: Client) => void;
    onRestore: (client: Client) => void;
    onViewHistory: (client: Client) => void;
};

export default function ClientsTable({
    clients,
    isRestoring,
    onEdit,
    onDelete,
    onRestore,
    onViewHistory,
}: ClientsTableProps) {
    if (clients.length === 0) {
        return <p className={styles.emptyState}>No hay clientes que coincidan con esos filtros.</p>;
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Contacto</th>
                        <th>Dirección</th>
                        <th>Estado</th>
                        <th className={styles.actionsHeader}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {clients.map((client) => {
                        const status = getClientStatus(client);
                        const isInactive = status === "Inactivo";

                        return (
                            <tr key={client.id}>
                                <td className={styles.clientName}>{client.name}</td>
                                <td>
                                    <div>{client.email}</div>
                                    <div className={styles.muted}>{client.phone}</div>
                                </td>
                                <td className={styles.muted}>
                                    {client.street} {client.number}, {client.city}, {client.province}
                                </td>
                                <td>
                                    <span className={`${styles.statusBadge} ${STATUS_STYLES[status] ?? ""}`}>
                                        {status}
                                    </span>
                                </td>
                                <td>
                                    <div className={styles.rowActions}>
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            onClick={() => onViewHistory(client)}
                                            title="Ver historial de pedidos"
                                        >
                                            <Clock size={16} />
                                        </button>

                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            onClick={() => onEdit(client)}
                                            title="Editar cliente"
                                        >
                                            <PencilLine size={16} />
                                        </button>

                                        {isInactive ? (
                                            <button
                                                type="button"
                                                className={styles.iconButton}
                                                onClick={() => onRestore(client)}
                                                disabled={isRestoring(client)}
                                                title="Restaurar cliente"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className={styles.iconButtonDanger}
                                                onClick={() => onDelete(client)}
                                                title="Eliminar cliente"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}