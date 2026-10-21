"use client";

// Styles
import styles from "./orders.module.css";

// Hooks
import { useState, useTransition } from "react";

// Data and actions
import { createOrder } from "@/modules/orders/orders.actions";
import type { NewOrderOptions } from "@/modules/orders/orders.dal";

// Utils
import { dayKey } from "@/modules/orders/orders.utils";

// Icons
import { Plus, Trash2 } from "lucide-react";

type CreateOrderModalProps = {
    options: NewOrderOptions;
    today: Date;
    // Día sugerido (el que se está mirando en la pantalla)
    initialDate: string;
    onClose: () => void;
    onCreated: (arrivalDate: string) => void;
};

type ItemRow = { key: number; productId: string; quantity: string };

export default function CreateOrderModal({
    options,
    today,
    initialDate,
    onClose,
    onCreated,
}: CreateOrderModalProps) {
    const [isPending, startTransition] = useTransition();
    const [clientId, setClientId] = useState("");
    const [arrivalDate, setArrivalDate] = useState(initialDate);
    const [items, setItems] = useState<ItemRow[]>([{ key: 0, productId: "", quantity: "1" }]);
    const [nextKey, setNextKey] = useState(1);
    const [error, setError] = useState("");

    const usedProductIds = items.map((item) => item.productId).filter(Boolean);
    const canAddItem = items.length < options.products.length;

    const updateItem = (key: number, changes: Partial<ItemRow>) => {
        setItems((current) =>
            current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
        );
    };

    const addItem = () => {
        setItems((current) => [...current, { key: nextKey, productId: "", quantity: "1" }]);
        setNextKey((key) => key + 1);
    };

    const removeItem = (key: number) => {
        setItems((current) => current.filter((item) => item.key !== key));
    };

    const handleSubmit = () => {
        if (!clientId) {
            setError("Elegí un cliente.");
            return;
        }
        if (!arrivalDate) {
            setError("Elegí una fecha.");
            return;
        }
        if (arrivalDate < dayKey(today)) {
            setError("No podés elegir una fecha pasada.");
            return;
        }

        const filled = items.filter((item) => item.productId);
        if (filled.length === 0) {
            setError("Agregá al menos un producto.");
            return;
        }

        const parsed = filled.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
        }));
        if (parsed.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
            setError("Cada producto necesita una cantidad entera mayor a cero.");
            return;
        }

        setError("");

        startTransition(async () => {
            const response = await createOrder(clientId, arrivalDate, parsed);

            if (response?.error) {
                setError(response.error);
                return;
            }

            onCreated(arrivalDate);
        });
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={`${styles.modal} ${styles.modalWide}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-order-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="create-order-title">Nuevo pedido</h3>
                    <p>Elegí el cliente, el día de entrega y los productos.</p>
                </div>

                <label className={styles.modalField} htmlFor="newOrderClient">
                    Cliente
                    <select
                        id="newOrderClient"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                    >
                        <option value="">Seleccioná un cliente</option>
                        {options.clients.map((client) => (
                            <option key={client.id} value={client.id}>
                                {client.name} · {client.street} {client.number}, {client.city}
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.modalField} htmlFor="newOrderDate">
                    Fecha de entrega
                    <input
                        id="newOrderDate"
                        type="date"
                        min={dayKey(today)}
                        value={arrivalDate}
                        onChange={(e) => setArrivalDate(e.target.value)}
                    />
                </label>

                <div className={styles.modalField}>
                    Productos
                    {options.products.length === 0 && (
                        <p className={styles.modalHint}>No hay productos cargados.</p>
                    )}

                    {items.map((item) => (
                        <div key={item.key} className={styles.itemRow}>
                            <select
                                aria-label="Producto"
                                value={item.productId}
                                onChange={(e) => updateItem(item.key, { productId: e.target.value })}
                            >
                                <option value="">Seleccioná un producto</option>
                                {options.products
                                    .filter(
                                        (product) =>
                                            product.id === item.productId ||
                                            !usedProductIds.includes(product.id),
                                    )
                                    .map((product) => (
                                        <option key={product.id} value={product.id}>
                                            {product.name}
                                        </option>
                                    ))}
                            </select>
                            <input
                                aria-label="Cantidad"
                                type="number"
                                min={1}
                                step={1}
                                value={item.quantity}
                                onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                            />
                            <button
                                type="button"
                                className={styles.itemRemoveButton}
                                onClick={() => removeItem(item.key)}
                                disabled={items.length === 1}
                                aria-label="Quitar producto"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}

                    <button
                        type="button"
                        className={styles.addItemButton}
                        onClick={addItem}
                        disabled={!canAddItem}
                    >
                        <Plus size={16} />
                        Agregar producto
                    </button>
                </div>

                {error && <p className={styles.modalError}>{error}</p>}

                <div className={styles.modalActions}>
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleSubmit}
                        disabled={isPending}
                    >
                        {isPending ? "Creando..." : "Crear pedido"}
                    </button>
                </div>
            </div>
        </div>
    );
}
