"use client";

// Styles
import styles from "./transports.module.css";

// Constants
import { DRIVER_STATUS_OPTIONS } from "@/modules/transports/transports.constants";

// Icons
import { Plus, Search } from "lucide-react";

type DriversToolbarProps = {
    search: string;
    onSearchChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
    onCreate: () => void;
};

export default function DriversToolbar({
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    onCreate,
}: DriversToolbarProps) {
    return (
        <div className={styles.toolbar}>
            <div className={styles.searchBox}>
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, email o teléfono..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className={styles.select}
            >
                {DRIVER_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                        {status}
                    </option>
                ))}
            </select>

            <button type="button" className={styles.createButton} onClick={onCreate}>
                <Plus size={16} />
                Nuevo conductor
            </button>
        </div>
    );
}
