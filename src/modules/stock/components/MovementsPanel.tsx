"use client";

// Styles
import styles from "./stock.module.css";

// Hooks
import { useMemo, useState } from "react";
import { useResetOnChange } from "@/utils/hooks/useResetOnChange";

// Components
import PaginationControl from "@/components/ui/admin/pagination/PaginationControl";

// Constants and utils
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS, STOCK_HISTORY_LIMIT } from "@/modules/stock/stock.constants";
import { formatDayKey } from "@/modules/costs/costs.utils";
import { formatDateTimeAR, formatSignedQuantity } from "@/modules/stock/stock.utils";

// Types
import type { MovementType, StockMovement } from "@/modules/stock/stock.types";

type MovementsPanelProps = {
    movements: StockMovement[];
};

const ROWS_PER_PAGE = 20;
const numberFormatter = new Intl.NumberFormat("es-AR");

const TYPE_BADGE: Record<MovementType, string> = {
    ingreso: styles.badgeSuccess,
    egreso: styles.badgeDanger,
    ajuste: styles.badgeWarning,
    pedido: styles.badgeInfo,
    devolucion: "",
};

function movementDetail(movement: StockMovement) {
    if (movement.order) {
        const client = movement.order.clientName ?? "cliente eliminado";
        const base = `Pedido de ${client} para el ${formatDayKey(movement.order.arrivalDate)}`;
        return movement.reason ? `${base} · ${movement.reason}` : base;
    }
    return movement.reason ?? "—";
}

export default function MovementsPanel({ movements }: MovementsPanelProps) {
    const [productFilter, setProductFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useResetOnChange([productFilter, typeFilter], () => setCurrentPage(1));

    // Productos que aparecen en el historial (incluye eliminados)
    const productOptions = useMemo(() => {
        const names = new Map<string, string>();
        for (const movement of movements) names.set(movement.productId, movement.productName);
        return [...names].sort((a, b) => a[1].localeCompare(b[1]));
    }, [movements]);

    const filtered = useMemo(
        () =>
            movements.filter(
                (movement) =>
                    (!productFilter || movement.productId === productFilter) &&
                    (!typeFilter || movement.type === typeFilter),
            ),
        [movements, productFilter, typeFilter],
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
                <label>
                    <span className={styles.srOnly}>Filtrar por tipo</span>
                    <select className={styles.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="">Todos los tipos</option>
                        {MOVEMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {MOVEMENT_TYPE_LABELS[type]}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <caption className={styles.srOnly}>Movimientos de stock</caption>
                    <thead>
                        <tr>
                            <th scope="col">Fecha</th>
                            <th scope="col">Producto</th>
                            <th scope="col">Tipo</th>
                            <th scope="col" className={styles.numeric}>Cantidad</th>
                            <th scope="col" className={styles.numeric}>Stock después</th>
                            <th scope="col">Detalle</th>
                            <th scope="col">Usuario</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className={styles.emptyState}>
                                    {movements.length === 0
                                        ? "Todavía no hay movimientos. Se registran al cargar stock y al crear o cancelar pedidos."
                                        : "No hay movimientos que coincidan con esos filtros."}
                                </td>
                            </tr>
                        ) : (
                            pageRows.map((movement) => (
                                <tr key={movement.id}>
                                    <td className={`${styles.muted} ${styles.dateCell}`}>
                                        {formatDateTimeAR(movement.createdAt)}
                                    </td>
                                    <td className={styles.productName}>{movement.productName}</td>
                                    <td>
                                        <span className={`${styles.badge} ${TYPE_BADGE[movement.type]}`}>
                                            {MOVEMENT_TYPE_LABELS[movement.type]}
                                        </span>
                                    </td>
                                    <td
                                        className={`${styles.numeric} ${movement.quantity > 0 ? styles.quantityIn : styles.quantityOut}`}
                                    >
                                        {formatSignedQuantity(movement.quantity)}
                                    </td>
                                    <td className={styles.numeric}>{numberFormatter.format(movement.stockAfter)}</td>
                                    <td>{movementDetail(movement)}</td>
                                    <td className={styles.muted}>{movement.authorName ?? "Sistema"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {filtered.length > ROWS_PER_PAGE && (
                <PaginationControl currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages} />
            )}

            {movements.length >= STOCK_HISTORY_LIMIT && (
                <p className={styles.hint}>Se muestran los últimos {STOCK_HISTORY_LIMIT} movimientos.</p>
            )}
        </>
    );
}
