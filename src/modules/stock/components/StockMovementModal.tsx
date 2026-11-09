"use client";

// Styles
import styles from "./stock.module.css";

// Hooks
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useStockAction } from "./useStockAction";

// Actions, constants and utils
import { adjustStock } from "@/modules/stock/stock.actions";
import {
    MANUAL_MOVEMENT_OPTIONS,
    MANUAL_MOVEMENT_TYPES,
    MAX_MOVEMENT_REASON_LENGTH,
} from "@/modules/stock/stock.constants";
import { formatUnits, stockAfterMovement } from "@/modules/stock/stock.utils";

// Types
import type { ManualMovementType, Product } from "@/modules/stock/stock.types";

type StockMovementModalProps = {
    product: Product;
    onClose: () => void;
    onSaved: (message: string) => void;
};

export default function StockMovementModal({ product, onClose, onSaved }: StockMovementModalProps) {
    const { run, isPending, error } = useStockAction();
    const [type, setType] = useState<ManualMovementType>("ingreso");
    const [quantity, setQuantity] = useState("");

    const option = MANUAL_MOVEMENT_OPTIONS[type];
    const parsedQuantity = /^\d+$/.test(quantity) ? Number(quantity) : null;
    const resultingStock =
        parsedQuantity == null ? null : stockAfterMovement(product.stock, type, parsedQuantity);

    // Patrón radiogroup de WAI-ARIA: las flechas mueven la selección
    const handleSegmentKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = MANUAL_MOVEMENT_TYPES.indexOf(type);
        let next: number | null = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % MANUAL_MOVEMENT_TYPES.length;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp")
            next = (index - 1 + MANUAL_MOVEMENT_TYPES.length) % MANUAL_MOVEMENT_TYPES.length;
        if (next === null) return;
        event.preventDefault();
        setType(MANUAL_MOVEMENT_TYPES[next]);
        const group = event.currentTarget.parentElement;
        (group?.children[next] as HTMLButtonElement | undefined)?.focus();
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("productId", product.id);
        formData.set("type", type);

        run(
            () => adjustStock(formData),
            () =>
                onSaved(
                    `Stock de ${product.name} actualizado${resultingStock != null ? `: ${formatUnits(resultingStock)}` : ""}.`,
                ),
        );
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="stock-movement-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="stock-movement-title">Mover stock · {product.name}</h3>
                    <p>
                        Stock actual: <strong>{formatUnits(product.stock)}</strong>. Los pedidos descuentan
                        solos al crearse y devuelven al cancelarse.
                    </p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    <div className={styles.segmented} role="radiogroup" aria-label="Tipo de movimiento">
                        {MANUAL_MOVEMENT_TYPES.map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={type === value}
                                tabIndex={type === value ? 0 : -1}
                                className={styles.segment}
                                onClick={() => setType(value)}
                                onKeyDown={handleSegmentKeyDown}
                            >
                                {MANUAL_MOVEMENT_OPTIONS[value].label}
                            </button>
                        ))}
                    </div>
                    <p className={styles.hint}>{option.hint}</p>

                    <label className={styles.field}>
                        {option.quantityLabel}
                        <input
                            name="quantity"
                            type="number"
                            inputMode="numeric"
                            min={type === "ajuste" ? 0 : 1}
                            step="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            required
                            autoFocus
                        />
                    </label>

                    <label className={styles.field}>
                        Motivo {type === "ingreso" && <span className={styles.hint}>(opcional)</span>}
                        <input
                            name="reason"
                            type="text"
                            maxLength={MAX_MOVEMENT_REASON_LENGTH}
                            placeholder={
                                type === "ingreso"
                                    ? "Producción del día, remito 0001-2345..."
                                    : type === "egreso"
                                      ? "Rotura en el depósito"
                                      : "Conteo del depósito"
                            }
                            required={type !== "ingreso"}
                        />
                    </label>

                    {resultingStock != null && (
                        <div className={styles.stockPreview} aria-live="polite">
                            <span>Stock después del movimiento</span>
                            <strong className={resultingStock < 0 ? styles.quantityOut : undefined}>
                                {resultingStock < 0 ? "No alcanza" : formatUnits(resultingStock)}
                            </strong>
                        </div>
                    )}

                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.secondaryButton} onClick={onClose}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={styles.primaryButton}
                            disabled={isPending || (resultingStock != null && resultingStock < 0)}
                        >
                            {isPending ? "Guardando..." : "Registrar movimiento"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
