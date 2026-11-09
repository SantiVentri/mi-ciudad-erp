"use client";

// Styles
import styles from "./costs.module.css";

// Hooks
import { useRef, useState, type FormEvent } from "react";
import { useCostsAction } from "./useCostsAction";

// Actions and constants
import { addRouteExpense } from "@/modules/costs/costs.actions";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, MAX_EXPENSE_NOTES_LENGTH } from "@/modules/costs/costs.constants";
import { isExpenseType } from "@/modules/costs/costs.utils";

// Types
import type { ExpenseType } from "@/modules/costs/costs.types";

type RouteExpenseFormProps = {
    routeId: string;
};

// Formulario del conductor para cargar peajes y otros gastos mientras la ruta está en curso
export default function RouteExpenseForm({ routeId }: RouteExpenseFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [type, setType] = useState<ExpenseType>("toll");
    const { run, isPending, error, success } = useCostsAction();

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("routeId", routeId);
        run(() => addRouteExpense(formData), "Gasto cargado.", () => {
            formRef.current?.reset();
            setType("toll");
        });
    };

    const notesRequired = type === "other";

    return (
        <form ref={formRef} className={styles.expenseForm} onSubmit={handleSubmit} noValidate>
            <label className={styles.field} htmlFor="expenseType">
                Tipo de gasto
                <select
                    id="expenseType"
                    name="type"
                    value={type}
                    onChange={(event) => {
                        if (isExpenseType(event.target.value)) setType(event.target.value);
                    }}
                >
                    {EXPENSE_TYPES.map((option) => (
                        <option key={option} value={option}>
                            {EXPENSE_TYPE_LABELS[option]}
                        </option>
                    ))}
                </select>
            </label>

            <label className={styles.field} htmlFor="expenseAmount">
                Monto ($)
                <input
                    id="expenseAmount"
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    placeholder="2500"
                    required
                />
            </label>

            <label className={styles.field} htmlFor="expenseNotes">
                {notesRequired ? "Nota (obligatoria)" : "Nota (opcional)"}
                <textarea
                    id="expenseNotes"
                    name="notes"
                    maxLength={MAX_EXPENSE_NOTES_LENGTH}
                    placeholder={notesRequired ? "Contá qué fue el gasto" : "Ej.: peaje Acceso Oeste"}
                    required={notesRequired}
                />
            </label>

            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            {success && (
                <p className={styles.success} role="status">
                    {success}
                </p>
            )}

            <button type="submit" className={styles.primaryButton} disabled={isPending}>
                {isPending ? "Cargando..." : "Cargar gasto"}
            </button>
        </form>
    );
}
