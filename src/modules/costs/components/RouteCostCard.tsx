"use client";

// Styles
import styles from "./costs.module.css";

// Hooks
import { useCostsAction } from "./useCostsAction";

// Components
import RouteExpensesList from "./RouteExpensesList";

// Actions and utils
import { recalculateRouteCost } from "@/modules/costs/costs.actions";
import { formatCurrency, formatKm, formatMinutes, formatVariance } from "@/modules/costs/costs.utils";

// Types
import type { RouteCostDetail } from "@/modules/costs/costs.types";

// Icons
import { RefreshCw } from "lucide-react";

type RouteCostCardProps = {
    routeId: string;
    routeState: string | null;
    // null: la ruta no tiene estimación todavía
    cost: RouteCostDetail | null;
};

// Detalle de costo de una ruta en el módulo Rutas. Solo se renderiza para admin.
export default function RouteCostCard({ routeId, routeState, cost }: RouteCostCardProps) {
    const { run, isPending, error, success } = useCostsAction();

    const hasCost = cost?.estimatedFuelCost != null && cost.estimatedLaborCost != null;
    // Una ruta que ya salió conserva el costo con el que se planificó; solo se completa si falta
    const canRecalculate = routeState !== "Cancelada" && (!hasCost || routeState === "Pendiente");
    const variance = cost?.durationVarianceMin ?? null;
    const varianceClass =
        variance == null || Math.round(variance) === 0
            ? ""
            : variance > 0
              ? styles.varianceOver
              : styles.varianceUnder;

    const handleRecalculate = () =>
        run(() => recalculateRouteCost(routeId), "Costo actualizado con los precios y sueldos vigentes.");

    return (
        <section className={styles.routeCostCard} aria-labelledby={`route-cost-title-${routeId}`}>
            <div className={styles.routeCostHeader}>
                <h4 id={`route-cost-title-${routeId}`}>Costo de la ruta</h4>
                {canRecalculate && (
                    <button
                        type="button"
                        className={`${styles.secondaryButton} ${styles.smallButton}`}
                        onClick={handleRecalculate}
                        disabled={isPending}
                    >
                        <RefreshCw size={14} aria-hidden="true" />
                        {isPending ? "Calculando..." : "Recalcular costo"}
                    </button>
                )}
            </div>

            {!hasCost && routeState !== "Cancelada" && !error && (
                <p className={styles.warning}>
                    Todavía no se calculó el costo de esta ruta. Tocá Recalcular costo para ver qué
                    dato falta cargar.
                </p>
            )}
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

            <dl className={styles.costStats}>
                <div>
                    <dt>Distancia</dt>
                    <dd>{formatKm(cost?.estimatedDistanceKm)}</dd>
                </div>
                <div>
                    <dt>Duración estimada</dt>
                    <dd>{formatMinutes(cost?.estimatedDurationMin)}</dd>
                </div>
                <div>
                    <dt>Duración real</dt>
                    <dd>{formatMinutes(cost?.actualDurationMin)}</dd>
                </div>
                <div>
                    <dt>Desvío</dt>
                    <dd className={varianceClass}>{formatVariance(variance)}</dd>
                </div>
                <div>
                    <dt>Combustible</dt>
                    <dd>{formatCurrency(cost?.estimatedFuelCost)}</dd>
                </div>
                <div>
                    <dt>Mano de obra</dt>
                    <dd>{formatCurrency(cost?.estimatedLaborCost)}</dd>
                </div>
                <div>
                    <dt>Gastos extra</dt>
                    <dd>{formatCurrency(cost?.totalExpenses ?? 0)}</dd>
                </div>
                <div className={styles.costTotal}>
                    <dt>Total</dt>
                    <dd>{hasCost ? formatCurrency(cost?.estimatedCostPlusExpenses) : "—"}</dd>
                </div>
            </dl>

            <p className={styles.muted}>
                La duración estimada incluye la vuelta a la embotelladora y la descarga en cada
                parada; la real va desde que el conductor inicia la ruta hasta que la finaliza.
            </p>

            {cost && cost.expenses.length > 0 && (
                <div className={styles.expenseSection}>
                    <h5 className={styles.routeCostSubtitle}>Gastos cargados por el conductor</h5>
                    <RouteExpensesList expenses={cost.expenses} />
                </div>
            )}
        </section>
    );
}
