"use client";

// Styles
import styles from "./stock.module.css";

// Hooks
import type { FormEvent } from "react";
import { useStockAction } from "./useStockAction";

// Actions and constants
import { createProduct, updateProduct } from "@/modules/stock/stock.actions";
import { MAX_PRODUCT_DESCRIPTION_LENGTH, MAX_PRODUCT_NAME_LENGTH } from "@/modules/stock/stock.constants";

// Types
import type { Product } from "@/modules/stock/stock.types";

type ProductFormModalProps = {
    product: Product | null; // null = creando, Product = editando
    onClose: () => void;
    onSaved: (message: string) => void;
};

export default function ProductFormModal({ product, onClose, onSaved }: ProductFormModalProps) {
    const { run, isPending, error } = useStockAction();
    const isEditing = product !== null;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        run(
            () => (product ? updateProduct(product.id, formData) : createProduct(formData)),
            () => onSaved(isEditing ? "Producto actualizado." : "Producto creado."),
        );
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-form-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="product-form-title">{isEditing ? "Editar producto" : "Nuevo producto"}</h3>
                    {isEditing && (
                        <p>
                            Si cambiás el precio, el anterior queda en el historial. Los pedidos ya
                            cargados conservan el precio con el que se hicieron.
                        </p>
                    )}
                </div>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    <label className={styles.field}>
                        Nombre
                        <input
                            name="name"
                            type="text"
                            defaultValue={product?.name ?? ""}
                            maxLength={MAX_PRODUCT_NAME_LENGTH}
                            placeholder="Bidón 20 Litros"
                            required
                            autoFocus
                        />
                    </label>

                    <label className={styles.field}>
                        Descripción <span className={styles.hint}>(opcional)</span>
                        <textarea
                            name="description"
                            defaultValue={product?.description ?? ""}
                            maxLength={MAX_PRODUCT_DESCRIPTION_LENGTH}
                            placeholder="Bidón de agua purificada retornable de 20L"
                        />
                    </label>

                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            Precio ($)
                            <input
                                name="price"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                defaultValue={product?.price ?? ""}
                                placeholder="7500"
                                required
                            />
                        </label>

                        <label className={styles.field}>
                            Stock mínimo
                            <input
                                name="minStock"
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                defaultValue={product?.minStock ?? 0}
                            />
                            <span className={styles.hint}>Por debajo, se marca como stock bajo.</span>
                        </label>

                        {!isEditing && (
                            <label className={styles.field}>
                                Stock inicial
                                <input
                                    name="initialStock"
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="1"
                                    defaultValue={0}
                                />
                                <span className={styles.hint}>Queda registrado como ingreso.</span>
                            </label>
                        )}
                    </div>

                    {isEditing && (
                        <p className={styles.hint}>
                            El stock no se edita acá: usá <strong>Mover stock</strong> para que quede
                            registrado el ingreso, egreso o ajuste.
                        </p>
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
                        <button type="submit" className={styles.primaryButton} disabled={isPending}>
                            {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear producto"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
