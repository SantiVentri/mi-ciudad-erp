"use client";

// Styles
import styles from "./stock.module.css";

// Hooks
import { useStockAction } from "./useStockAction";

// Actions
import { deleteProduct } from "@/modules/stock/stock.actions";

// Types
import type { Product } from "@/modules/stock/stock.types";

type DeleteProductDialogProps = {
    product: Product;
    onClose: () => void;
    onDeleted: (message: string) => void;
};

export default function DeleteProductDialog({ product, onClose, onDeleted }: DeleteProductDialogProps) {
    const { run, isPending, error } = useStockAction();

    const confirm = () => {
        run(
            () => deleteProduct(product.id),
            (message) => onDeleted(message ?? "Producto eliminado."),
        );
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-product-title"
                aria-describedby="delete-product-description"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="delete-product-title">Eliminar producto</h3>
                    <p id="delete-product-description">
                        {product.hasOrders ? (
                            <>
                                <strong>{product.name}</strong> aparece en pedidos, así que se va a
                                archivar: deja de aparecer acá y en los pedidos nuevos, pero los pedidos,
                                movimientos y precios anteriores se conservan. No se puede deshacer.
                            </>
                        ) : (
                            <>
                                <strong>{product.name}</strong> nunca se pidió, así que se borra
                                definitivamente junto con su historial de stock y precios. No se puede
                                deshacer.
                            </>
                        )}
                    </p>
                </div>

                {product.isActive && (
                    <p className={styles.warning}>
                        Si solo querés que no se pueda pedir por un tiempo, deshabilitalo en vez de
                        eliminarlo.
                    </p>
                )}

                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}

                <div className={styles.modalActions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose} autoFocus>
                        Cancelar
                    </button>
                    <button type="button" className={styles.dangerButton} onClick={confirm} disabled={isPending}>
                        {isPending ? "Eliminando..." : "Eliminar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
