// Styles
import styles from "./costs.module.css";

// Utils
import { expenseTypeLabel, formatCurrency, formatTimeAR } from "@/modules/costs/costs.utils";

// Types
import type { RouteExpense } from "@/modules/costs/costs.types";

type RouteExpensesListProps = {
    expenses: RouteExpense[];
    emptyMessage?: string;
};

// Sin datos laborales: se usa en la vista del conductor y en el detalle del admin
export default function RouteExpensesList({
    expenses,
    emptyMessage = "Todavía no se cargaron gastos en esta ruta.",
}: RouteExpensesListProps) {
    if (expenses.length === 0) {
        return <p className={styles.muted}>{emptyMessage}</p>;
    }

    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    return (
        <>
            <ul className={styles.expenseList}>
                {expenses.map((expense) => (
                    <li key={expense.id} className={styles.expenseItem}>
                        <div className={styles.expenseMain}>
                            <strong>{expenseTypeLabel(expense.type)}</strong>
                            {expense.notes && <span className={styles.expenseNotes}>{expense.notes}</span>}
                            <span className={styles.muted}>
                                {formatTimeAR(expense.createdAt)} h
                                {expense.authorName ? ` · ${expense.authorName}` : ""}
                            </span>
                        </div>
                        <span className={styles.expenseAmount}>{formatCurrency(expense.amount)}</span>
                    </li>
                ))}
            </ul>
            <p className={styles.expenseTotal}>
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
            </p>
        </>
    );
}
