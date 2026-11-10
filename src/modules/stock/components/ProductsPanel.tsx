"use client";

// Styles
import styles from "./stock.module.css";

// Hooks
import { useMemo, useState } from "react";
import { useStockAction } from "./useStockAction";

// Components
import ProductFormModal from "./ProductFormModal";
import StockMovementModal from "./StockMovementModal";
import PriceUpdateModal from "./PriceUpdateModal";
import DeleteProductDialog from "./DeleteProductDialog";

// Actions, constants and utils
import { setProductActive } from "@/modules/stock/stock.actions";
import { PRODUCT_STATUS_OPTIONS } from "@/modules/stock/stock.constants";
import { formatCurrency } from "@/modules/costs/costs.utils";
import {
    coverageDays,
    getStockLevel,
    matchesProductSearch,
    matchesStatus,
} from "@/modules/stock/stock.utils";

// Types
import type { Product, ProductStatusFilter } from "@/modules/stock/stock.types";

// Icons
import { Ban, Diff, PencilLine, Plus, RotateCcw, Search, Tags, Trash2 } from "lucide-react";

type ProductsPanelProps = {
    products: Product[];
};

type ModalState =
    | { kind: "form"; product: Product | null }
    | { kind: "movement"; product: Product }
    | { kind: "prices" }
    | { kind: "delete"; product: Product };

const numberFormatter = new Intl.NumberFormat("es-AR");

export default function ProductsPanel({ products }: ProductsPanelProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("Todos");
    const [modal, setModal] = useState<ModalState | null>(null);
    const [success, setSuccess] = useState("");
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const toggle = useStockAction();

    // Primero los activos y después los deshabilitados; dentro de cada grupo, por nombre
    const filtered = useMemo(
        () =>
            products
                .filter(
                    (product) => matchesStatus(product, statusFilter) && matchesProductSearch(product, search.trim()),
                )
                .sort(
                    (a, b) =>
                        Number(b.isActive) - Number(a.isActive) ||
                        a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true }),
                ),
        [products, search, statusFilter],
    );

    const openModal = (next: ModalState) => {
        setSuccess("");
        toggle.setError("");
        setModal(next);
    };

    const closeWith = (message: string) => {
        setModal(null);
        setSuccess(message);
    };

    const handleToggleActive = (product: Product) => {
        setSuccess("");
        setTogglingId(product.id);
        toggle.run(
            async () => {
                const result = await setProductActive(product.id, !product.isActive);
                setTogglingId(null);
                return result;
            },
            () =>
                setSuccess(
                    product.isActive
                        ? `${product.name} quedó deshabilitado: no se puede pedir hasta que lo habilites.`
                        : `${product.name} está habilitado otra vez.`,
                ),
        );
    };

    return (
        <>
            <div className={styles.toolbar}>
                <label className={styles.searchBox}>
                    <Search size={18} aria-hidden="true" />
                    <span className={styles.srOnly}>Buscar productos</span>
                    <input
                        type="search"
                        placeholder="Buscar por nombre o descripción..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>

                <label>
                    <span className={styles.srOnly}>Filtrar por estado</span>
                    <select
                        className={styles.select}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ProductStatusFilter)}
                    >
                        {PRODUCT_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                </label>

                <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => openModal({ kind: "prices" })}
                    disabled={products.length === 0}
                >
                    <Tags size={16} aria-hidden="true" />
                    Actualizar precios
                </button>

                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => openModal({ kind: "form", product: null })}
                >
                    <Plus size={16} aria-hidden="true" />
                    Nuevo producto
                </button>
            </div>

            {success && (
                <p className={styles.success} role="status">
                    {success}
                </p>
            )}
            {toggle.error && (
                <p className={styles.error} role="alert">
                    {toggle.error}
                </p>
            )}

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <caption className={styles.srOnly}>Productos y stock disponible</caption>
                    <thead>
                        <tr>
                            <th scope="col">Producto</th>
                            <th scope="col" className={styles.numeric}>Precio</th>
                            <th scope="col" className={styles.numeric}>Stock disponible</th>
                            <th scope="col" className={styles.numeric}>Valor del stock</th>
                            <th scope="col">Estado</th>
                            <th scope="col" className={styles.numeric}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className={styles.emptyState}>
                                    {products.length === 0
                                        ? "Todavía no hay productos. Creá el primero con «Nuevo producto»."
                                        : "No hay productos que coincidan con esos filtros."}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((product) => {
                                const level = getStockLevel(product);
                                const coverage = coverageDays(product);

                                return (
                                    <tr key={product.id} className={product.isActive ? undefined : styles.inactiveRow}>
                                        <td>
                                            <div className={styles.cellStack}>
                                                <span className={styles.productName}>{product.name}</span>
                                                {product.description && (
                                                    <span className={styles.muted}>{product.description}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={styles.numeric}>{formatCurrency(product.price)}</td>
                                        <td className={styles.numeric}>
                                            <div className={styles.cellStack}>
                                                <span className={styles.stockValue}>
                                                    {level === "out" && (
                                                        <span className={`${styles.badge} ${styles.badgeDanger}`}>Sin stock</span>
                                                    )}
                                                    {level === "low" && (
                                                        <span className={`${styles.badge} ${styles.badgeWarning}`}>Stock bajo</span>
                                                    )}
                                                    {numberFormatter.format(product.stock)}
                                                </span>
                                                <span className={styles.muted}>
                                                    mín. {numberFormatter.format(product.minStock)}
                                                    {coverage != null && ` · alcanza ≈ ${coverage} ${coverage === 1 ? "día" : "días"}`}
                                                </span>
                                            </div>
                                        </td>
                                        {/* Stock disponible × precio de lista */}
                                        <td className={`${styles.numeric} ${styles.productName}`}>
                                            {formatCurrency(product.stock * product.price)}
                                        </td>
                                        <td>
                                            <span
                                                className={`${styles.badge} ${product.isActive ? styles.badgeSuccess : ""}`}
                                            >
                                                {product.isActive ? "Activo" : "Deshabilitado"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    onClick={() => openModal({ kind: "movement", product })}
                                                    title="Mover stock"
                                                    aria-label={`Mover stock de ${product.name}`}
                                                >
                                                    <Diff size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    onClick={() => openModal({ kind: "form", product })}
                                                    title="Editar producto"
                                                    aria-label={`Editar ${product.name}`}
                                                >
                                                    <PencilLine size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.iconButton}
                                                    onClick={() => handleToggleActive(product)}
                                                    disabled={toggle.isPending && togglingId === product.id}
                                                    title={product.isActive ? "Deshabilitar" : "Habilitar"}
                                                    aria-label={`${product.isActive ? "Deshabilitar" : "Habilitar"} ${product.name}`}
                                                >
                                                    {product.isActive ? <Ban size={16} /> : <RotateCcw size={16} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.iconButtonDanger}
                                                    onClick={() => openModal({ kind: "delete", product })}
                                                    title="Eliminar producto"
                                                    aria-label={`Eliminar ${product.name}`}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <p className={styles.hint}>
                «Valor del stock» es el stock disponible por el precio de lista actual.
            </p>

            {modal?.kind === "form" && (
                <ProductFormModal product={modal.product} onClose={() => setModal(null)} onSaved={closeWith} />
            )}
            {modal?.kind === "movement" && (
                <StockMovementModal product={modal.product} onClose={() => setModal(null)} onSaved={closeWith} />
            )}
            {modal?.kind === "prices" && (
                <PriceUpdateModal products={products} onClose={() => setModal(null)} onSaved={closeWith} />
            )}
            {modal?.kind === "delete" && (
                <DeleteProductDialog product={modal.product} onClose={() => setModal(null)} onDeleted={closeWith} />
            )}
        </>
    );
}
