"use client";

// Styles
import styles from "./orders.module.css";

// Constants and types
import { STATE_OPTIONS } from "@/modules/orders/orders.constants";
import type { SortOption } from "@/modules/orders/orders.types";

// Icons
import { PencilLine, RefreshCw, Search } from "lucide-react";

type OrdersToolbarProps = {
    search: string;
    onSearchChange: (value: string) => void;
    stateFilter: string;
    onStateFilterChange: (value: string) => void;
    sortBy: SortOption;
    onSortByChange: (value: SortOption) => void;
    isPending: boolean;
    onRefresh: () => void;
    selectedCount: number;
    onBulkEdit: () => void;
};

export default function OrdersToolbar({
    search,
    onSearchChange,
    stateFilter,
    onStateFilterChange,
    sortBy,
    onSortByChange,
    isPending,
    onRefresh,
    selectedCount,
    onBulkEdit,
}: OrdersToolbarProps) {
    return (
        <div className={styles.toolbar}>
            <div className={styles.searchBox}>
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Buscar por cliente, email, teléfono o dirección..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <select
                value={stateFilter}
                onChange={(e) => onStateFilterChange(e.target.value)}
                className={styles.select}
            >
                {STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                        {state}
                    </option>
                ))}
            </select>

            <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value as SortOption)}
                className={styles.select}
            >
                <option value="cliente-asc">Cliente (A-Z)</option>
                <option value="cliente-desc">Cliente (Z-A)</option>
            </select>

            <button type="button" className={styles.refreshButton} onClick={onRefresh} disabled={isPending}>
                <RefreshCw size={16} />
                {isPending ? "Refrezcando..." : "Refrescar"}
            </button>

            <button
                type="button"
                className={styles.bulkEditButton}
                onClick={onBulkEdit}
                disabled={selectedCount === 0}
            >
                <PencilLine size={16} />
                Editar fechas ({selectedCount})
            </button>
        </div>
    );
}