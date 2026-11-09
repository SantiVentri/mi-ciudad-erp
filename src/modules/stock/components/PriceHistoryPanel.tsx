"use client";

// Styles
import styles from "./stock.module.css";

// Hooks
import { useMemo, useState } from "react";
import { useResetOnChange } from "@/utils/hooks/useResetOnChange";

// Components
import PaginationControl from "@/components/ui/admin/pagination/PaginationControl";

// Constants and utils
import { STOCK_HISTORY_LIMIT } from "@/modules/stock/stock.constants";
import { formatCurrency } from "@/modules/costs/costs.utils";
import { formatDateTimeAR, formatPriceChangePct } from "@/modules/stock/stock.utils";

// Types
import type { PriceChange } from "@/modules/stock/stock.types";

type PriceHistoryPanelProps = {
    priceHistory: PriceChange[];
};

const ROWS_PER_PAGE = 20;

export default function PriceHistoryPanel({ priceHistory }: PriceHistoryPanelProps) {
    const [productFilter, setProductFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useResetOnChange([productFilter], () => setCurrentPage(1));

    const productOptions = useMemo(() => {
        const names = new Map<string, string>();
        for (const change of priceHistory) names.set(change.productId, change.productName);
        return [...names].sort((a, b) => a[1].localeCompare(b[1]));
    }, [priceHistory]);

    const filtered = useMemo(
        () => priceHistory.filter((change) => !productFilter || change.productId === productFilter),
        [priceHistory, productFilter],
    );

    const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE) || 1;
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const pageRows = filtered.slice(startIndex, startIndex + ROWS_PER_PAGE);

    return (
        <>
            <div className={styles.toolbar}>
                <label>
                    <span className={styles.srOnly}>Filtrar por producto</span>
                    <select className={styles.select} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                        <option value="">Todos los productos</option>
                        {productOptions.map(([id, name]) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <caption className={styles.srOnly}>Historial de precios</caption>
                    <thead>
                        <tr>
                            <th scope="col">Fecha</th>
                            <th scope="col">Producto</th>
                            <th scope="col" className={styles.numeric}>Precio anterior</th>
                            <th scope="col" className={styles.numeric}>Precio nuevo</th>
                            <th scope="col" className={styles.numeric}>Variación</th>
                            <th scope="col">Usuario</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className={styles.emptyState}>
                                    Todavía no hay cambios de precio.
                                </td>
                            </tr>
                        ) : (
                            pageRows.map((change) => {
                                const pct = formatPriceChangePct(change.price, change.previousPrice);

                                return (
                                    <tr key={change.id}>
                                        <td className={`${styles.muted} ${styles.dateCell}`}>
                                            {formatDateTimeAR(change.createdAt)}
                                        </td>
                                        <td className={styles.productName}>{change.productName}</td>
                                        <td className={`${styles.numeric} ${styles.muted}`}>
                                            {change.previousPrice == null ? "Precio inicial" : formatCurrency(change.previousPrice)}
                                        </td>
                                        <td className={`${styles.numeric} ${styles.productName}`}>
                                            {formatCurrency(change.price)}
                                        </td>
                                        <td className={`${styles.numeric} ${styles.muted}`}>
                                            {pct ?? "—"}
                                        </td>
                                        <td className={styles.muted}>{change.authorName ?? "Sistema"}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {filtered.length > ROWS_PER_PAGE && (
                <PaginationControl currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages} />
            )}

            {priceHistory.length >= STOCK_HISTORY_LIMIT && (
                <p className={styles.hint}>Se muestran los últimos {STOCK_HISTORY_LIMIT} cambios de precio.</p>
            )}
        </>
    );
}
