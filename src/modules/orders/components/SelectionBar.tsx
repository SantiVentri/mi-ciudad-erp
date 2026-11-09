"use client";

// Styles
import styles from "./orders.module.css";

// Icons
import { Ban, CheckSquare, PencilLine, RotateCcw, X } from "lucide-react";

type SelectionBarProps = {
    selectedCount: number;
    visibleCount: number;
    // Cuántos de los seleccionados se pueden cancelar / restaurar de verdad
    cancellableCount: number;
    restorableCount: number;
    isPending: boolean;
    onSelectAll: () => void;
    onClear: () => void;
    onEditDates: () => void;
    onCancel: () => void;
    onRestore: () => void;
};

// Acciones sobre los pedidos seleccionados; aparece apenas se selecciona uno
export default function SelectionBar({
    selectedCount,
    visibleCount,
    cancellableCount,
    restorableCount,
    isPending,
    onSelectAll,
    onClear,
    onEditDates,
    onCancel,
    onRestore,
}: SelectionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className={styles.selectionBar} role="region" aria-label="Acciones sobre la selección">
            <div className={styles.selectionInfo}>
                <strong>
                    {selectedCount} {selectedCount === 1 ? "seleccionado" : "seleccionados"}
                </strong>
                {selectedCount < visibleCount && (
                    <button type="button" className={styles.selectionLink} onClick={onSelectAll}>
                        <CheckSquare size={14} />
                        Seleccionar los {visibleCount}
                    </button>
                )}
                <button type="button" className={styles.selectionLink} onClick={onClear}>
                    <X size={14} />
                    Quitar selección
                </button>
            </div>

            <div className={styles.selectionActions}>
                <button
                    type="button"
                    className={styles.selectionButton}
                    onClick={onEditDates}
                    disabled={isPending}
                >
                    <PencilLine size={16} />
                    Editar fechas
                </button>
                <button
                    type="button"
                    className={`${styles.selectionButton} ${styles.selectionButtonDanger}`}
                    onClick={onCancel}
                    disabled={isPending || cancellableCount === 0}
                    title={cancellableCount === 0 ? "Ninguno de los seleccionados se puede cancelar" : undefined}
                >
                    <Ban size={16} />
                    Cancelar ({cancellableCount})
                </button>
                <button
                    type="button"
                    className={`${styles.selectionButton} ${styles.selectionButtonSuccess}`}
                    onClick={onRestore}
                    disabled={isPending || restorableCount === 0}
                    title={restorableCount === 0 ? "No hay pedidos cancelados para restaurar" : undefined}
                >
                    <RotateCcw size={16} />
                    Restaurar ({restorableCount})
                </button>
            </div>
        </div>
    );
}
