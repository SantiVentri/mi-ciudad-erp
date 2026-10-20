"use client";

// Styles
import styles from "./routes.module.css";

// Constants
import { ROUTE_STATE_OPTIONS } from "@/modules/routes/routes.constants";

// Icons
import { RefreshCw, Route, Search } from "lucide-react";

type RoutesToolbarProps = {
    search: string;
    onSearchChange: (value: string) => void;
    stateFilter: string;
    onStateFilterChange: (value: string) => void;
    isPending: boolean;
    onRefresh: () => void;
    canGenerate: boolean;
    onGenerate: () => void;
};

export default function RoutesToolbar({
    search,
    onSearchChange,
    stateFilter,
    onStateFilterChange,
    isPending,
    onRefresh,
    canGenerate,
    onGenerate,
}: RoutesToolbarProps) {
    return (
        <div className={styles.toolbar}>
            <div className={styles.searchBox}>
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Buscar por n° de ruta, conductor, patente o cliente..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <select
                value={stateFilter}
                onChange={(e) => onStateFilterChange(e.target.value)}
                className={styles.select}
            >
                {ROUTE_STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                        {state}
                    </option>
                ))}
            </select>

            <button
                type="button"
                className={styles.refreshButton}
                onClick={onRefresh}
                disabled={isPending}
            >
                <RefreshCw size={16} />
                {isPending ? "Refrescando..." : "Refrescar"}
            </button>

            <button
                type="button"
                className={styles.generateButton}
                onClick={onGenerate}
                disabled={!canGenerate}
                title={
                    canGenerate
                        ? "Generar una ruta con los pedidos sin ruta de este día"
                        : "No se pueden generar rutas para días pasados"
                }
            >
                <Route size={16} />
                Generar ruta
            </button>
        </div>
    );
}
