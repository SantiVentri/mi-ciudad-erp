"use client";

// Styles
import styles from "./costs.module.css";

// Hooks
import { useRef, type FormEvent } from "react";
import { useCostsAction } from "./useCostsAction";

// Components
import ValidityBadge from "./ValidityBadge";

// Actions and utils
import { createFuelPrice } from "@/modules/costs/costs.actions";
import { formatCurrency, formatDayKey } from "@/modules/costs/costs.utils";

// Types
import type { FuelPrice } from "@/modules/costs/costs.types";

type FuelPricesPanelProps = {
    today: string;
    fuelPrices: FuelPrice[];
};

export default function FuelPricesPanel({ today, fuelPrices }: FuelPricesPanelProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const { run, isPending, error, success } = useCostsAction();

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        run(() => createFuelPrice(formData), "Precio guardado. El anterior quedó cerrado el día previo.", () =>
            formRef.current?.reset(),
        );
    };

    return (
        <>
            <p className={styles.panelIntro}>
                El precio por litro se usa para estimar el combustible de cada ruta según su
                fecha. Al cargar uno nuevo, el anterior deja de estar vigente el día antes.
            </p>

            <form ref={formRef} className={styles.card} onSubmit={handleSubmit} noValidate>
                <h2 className={styles.cardTitle}>Nuevo precio de combustible</h2>
                <div className={styles.formGrid}>
                    <label className={styles.field} htmlFor="fuelPricePerLiter">
                        Precio por litro ($)
                        <input
                            id="fuelPricePerLiter"
                            name="pricePerLiter"
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            step="0.01"
                            placeholder="1450"
                            required
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? "fuelPriceError" : undefined}
                        />
                    </label>
                    <label className={styles.field} htmlFor="fuelValidFrom">
                        Vigente desde
                        <input
                            id="fuelValidFrom"
                            name="validFrom"
                            type="date"
                            defaultValue={today}
                            required
                        />
                    </label>
                </div>

                {error && (
                    <p id="fuelPriceError" className={styles.error} role="alert">
                        {error}
                    </p>
                )}
                {success && (
                    <p className={styles.success} role="status">
                        {success}
                    </p>
                )}

                <div className={styles.formActions}>
                    <button type="submit" className={styles.primaryButton} disabled={isPending}>
                        {isPending ? "Guardando..." : "Guardar precio"}
                    </button>
                </div>
            </form>

            <div className={styles.tableWrapper}>
                <table className={`${styles.table} ${styles.fitColumns}`}>
                    <caption className={styles.srOnly}>Historial de precios de combustible</caption>
                    <thead>
                        <tr>
                            <th scope="col" className={styles.numeric}>Precio por litro</th>
                            <th scope="col">Desde</th>
                            <th scope="col">Hasta</th>
                            <th scope="col">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fuelPrices.length === 0 ? (
                            <tr>
                                <td colSpan={4} className={styles.emptyState}>
                                    Todavía no cargaste ningún precio. Sin precio no se puede estimar
                                    el costo de las rutas.
                                </td>
                            </tr>
                        ) : (
                            fuelPrices.map((price) => (
                                <tr key={price.id}>
                                    <td className={`${styles.numeric} ${styles.primaryCell}`}>
                                        {formatCurrency(price.pricePerLiter)}
                                    </td>
                                    <td>{formatDayKey(price.validFrom)}</td>
                                    <td>{price.validTo ? formatDayKey(price.validTo) : "—"}</td>
                                    <td>
                                        <ValidityBadge validFrom={price.validFrom} validTo={price.validTo} today={today} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
