"use client";

// Styles
import styles from "./clients.module.css";

// Constants
import { STATUS_OPTIONS } from "@/modules/clients/clients.constants";

// Icons
import { Plus, Search } from "lucide-react";

type ClientsToolbarProps = {
    search: string;
    onSearchChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
    onCreate: () => void;
};

export default function ClientsToolbar({
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    onCreate,
}: ClientsToolbarProps) {
    return (
        <div className={styles.toolbar}>
            <div className={styles.searchBox}>
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, email, teléfono o dirección..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className={styles.select}
            >
                {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                        {status}
                    </option>
                ))}
            </select>

            <button type="button" className={styles.createButton} onClick={onCreate}>
                <Plus size={16} />
                Nuevo cliente
            </button>
        </div>
    );
}