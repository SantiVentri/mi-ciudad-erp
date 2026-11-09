"use client";

// Styles
import styles from "./stock.module.css";

// Hooks
import { useState } from "react";
import { useStockAction } from "./useStockAction";

// Actions and utils
import { updatePrices } from "@/modules/stock/stock.actions";
import { formatCurrency, parseDecimal } from "@/modules/costs/costs.utils";
import { applyIncrease, formatPriceChangePct } from "@/modules/stock/stock.utils";

// Types
import type { Product } from "@/modules/stock/stock.types";

type PriceUpdateModalProps = {
    products: Product[];
    onClose: () => void;
    onSaved: (message: string) => void;
};

export default function PriceUpdateModal({ products, onClose, onSaved }: PriceUpdateModalProps) {
    const { run, isPending, error, setError } = useStockAction();
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(products.map((product) => [product.id, String(product.price)])),
    );
    const [increasePct, setIncreasePct] = useState("");

    const parsed = products.map((product) => {
        const raw = values[product.id] ?? "";
        const price = parseDecimal(raw);
        return {
            product,
            price,
            invalid: price == null,
            changed: price != null && Math.abs(price - product.price) >= 0.005,
        };
    });
    const changes = parsed.filter((row) => row.changed);
    const hasInvalid = parsed.some((row) => row.invalid);

    const applyToAll = () => {
        const pct = parseDecimal(increasePct.replace(/^-/, ""));
        if (pct == null) {
            setError("Ingresá el porcentaje como un número, por ejemplo 8 o 12,5.");
            return;
        }
        const signed = increasePct.trim().startsWith("-") ? -pct : pct;
        setError("");
        setValues(
            Object.fromEntries(
                products.map((product) => [product.id, String(applyIncrease(product.price, signed))]),
            ),
        );
    };

    const reset = () => {
        setError("");
        setValues(Object.fromEntries(products.map((product) => [product.id, String(product.price)])));
    };

    const handleSave = () => {
        if (hasInvalid) {
            setError("Hay precios que no son números. Corregilos antes de guardar.");
            return;
        }
        run(
            () => updatePrices(changes.map((row) => ({ productId: row.product.id, price: row.price ?? 0 }))),
            (message) => onSaved(message ?? "Precios actualizados."),
        );
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={`${styles.modal} ${styles.modalWide}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="price-update-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="price-update-title">Actualizar precios</h3>
                    <p>
                        Cambiá los precios uno por uno o aplicá un aumento a todos. Cada cambio queda en el
                        historial y los pedidos ya cargados conservan su precio.
                    </p>
                </div>

                <div className={styles.bulkIncrease}>
                    <label className={styles.field}>
                        Aumento para todos (%)
                        <input
                            type="text"
                            inputMode="decimal"
                            value={increasePct}
                            onChange={(e) => setIncreasePct(e.target.value)}
                            placeholder="8"
                        />
                    </label>
                    <button type="button" className={`${styles.secondaryButton} ${styles.smallButton}`} onClick={applyToAll}>
                        Aplicar a todos
                    </button>
                    <button type="button" className={`${styles.secondaryButton} ${styles.smallButton}`} onClick={reset}>
                        Deshacer cambios
                    </button>
                    <span className={styles.hint}>Se redondea a $10.</span>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <caption className={styles.srOnly}>Precios nuevos por producto</caption>
                        <thead>
                            <tr>
                                <th scope="col">Producto</th>
                                <th scope="col" className={styles.numeric}>Actual</th>
                                <th scope="col" className={styles.numeric}>Nuevo</th>
                                <th scope="col" className={styles.numeric}>Variación</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parsed.map(({ product, price, invalid, changed }) => (
                                <tr key={product.id} className={changed ? styles.changedRow : undefined}>
                                    <td>
                                        <div className={styles.cellStack}>
                                            <span className={styles.productName}>{product.name}</span>
                                            {!product.isActive && <span className={styles.muted}>Deshabilitado</span>}
                                        </div>
                                    </td>
                                    <td className={styles.numeric}>{formatCurrency(product.price)}</td>
                                    <td className={styles.numeric}>
                                        <input
                                            className={styles.priceInput}
                                            type="text"
                                            inputMode="decimal"
                                            aria-label={`Precio nuevo de ${product.name}`}
                                            aria-invalid={invalid || undefined}
                                            value={values[product.id] ?? ""}
                                            onChange={(e) =>
                                                setValues((current) => ({ ...current, [product.id]: e.target.value }))
                                            }
                                        />
                                    </td>
                                    <td className={`${styles.numeric} ${styles.muted}`}>
                                        {changed && price != null
                                            ? (formatPriceChangePct(price, product.price) ?? "—")
                                            : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

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
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleSave}
                        disabled={isPending || changes.length === 0}
                    >
                        {isPending
                            ? "Guardando..."
                            : changes.length === 0
                              ? "Sin cambios"
                              : `Guardar ${changes.length} ${changes.length === 1 ? "precio" : "precios"}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
