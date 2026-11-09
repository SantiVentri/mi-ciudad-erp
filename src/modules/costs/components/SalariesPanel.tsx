"use client";

// Styles
import styles from "./costs.module.css";

// Hooks
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useCostsAction } from "./useCostsAction";

// Components
import ValidityBadge from "./ValidityBadge";

// Actions, constants and utils
import { createSalary } from "@/modules/costs/costs.actions";
import { DEFAULT_MONTHLY_HOURS } from "@/modules/costs/costs.constants";
import {
    formatCurrency,
    formatDayKey,
    formatNumber,
    getValidityStatus,
    hourlyCost,
} from "@/modules/costs/costs.utils";

// Types
import type { EmployeeOption, Salary } from "@/modules/costs/costs.types";

type SalariesPanelProps = {
    today: string;
    salaries: Salary[];
    employees: EmployeeOption[];
};

export default function SalariesPanel({ today, salaries, employees }: SalariesPanelProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [showHistory, setShowHistory] = useState(false);
    const { run, isPending, error, success } = useCostsAction();

    const currentSalaries = useMemo(
        () => salaries.filter((salary) => getValidityStatus(salary.validFrom, salary.validTo, today) === "current"),
        [salaries, today],
    );

    const visibleSalaries = showHistory ? salaries : currentSalaries;

    const employeesWithoutSalary = useMemo(() => {
        const withSalary = new Set(currentSalaries.map((salary) => salary.profileId));
        return employees.filter((employee) => !withSalary.has(employee.id));
    }, [employees, currentSalaries]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        run(() => createSalary(formData), "Sueldo guardado. El anterior de ese empleado quedó cerrado el día previo.", () =>
            formRef.current?.reset(),
        );
    };

    return (
        <>
            <p className={styles.panelIntro}>
                El costo por hora de cada conductor y acompañante es sueldo mensual × (1 + cargas
                sociales) ÷ horas mensuales pagas. Se usa con la duración estimada de la ruta.
            </p>

            {employeesWithoutSalary.length > 0 && (
                <p className={styles.warning}>
                    Sin sueldo vigente:{" "}
                    <strong>{employeesWithoutSalary.map((employee) => employee.label).join(", ")}</strong>.
                    No se puede calcular el costo de sus rutas hasta que lo cargues.
                </p>
            )}

            <form ref={formRef} className={styles.card} onSubmit={handleSubmit} noValidate>
                <h2 className={styles.cardTitle}>Nuevo sueldo</h2>
                <div className={styles.formGrid}>
                    <label className={styles.field} htmlFor="salaryProfile">
                        Empleado
                        <select id="salaryProfile" name="profileId" defaultValue="" required>
                            <option value="" disabled>
                                Elegí un empleado
                            </option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.field} htmlFor="salaryMonthly">
                        Sueldo mensual bruto ($)
                        <input
                            id="salaryMonthly"
                            name="monthlySalary"
                            type="number"
                            inputMode="decimal"
                            min="1"
                            step="0.01"
                            placeholder="1800000"
                            required
                        />
                    </label>
                    <label className={styles.field} htmlFor="salaryCharges">
                        Cargas sociales (%)
                        <input
                            id="salaryCharges"
                            name="socialChargesPct"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            placeholder="30"
                            aria-describedby="salaryChargesHint"
                        />
                        <span id="salaryChargesHint" className={styles.hint}>
                            Vacío = 0 %
                        </span>
                    </label>
                    <label className={styles.field} htmlFor="salaryHours">
                        Horas pagas por mes
                        <input
                            id="salaryHours"
                            name="monthlyHours"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            step="1"
                            defaultValue={DEFAULT_MONTHLY_HOURS}
                            required
                        />
                    </label>
                    <label className={styles.field} htmlFor="salaryValidFrom">
                        Vigente desde
                        <input id="salaryValidFrom" name="validFrom" type="date" defaultValue={today} required />
                    </label>
                </div>

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

                <div className={styles.formActions}>
                    <button type="submit" className={styles.primaryButton} disabled={isPending}>
                        {isPending ? "Guardando..." : "Guardar sueldo"}
                    </button>
                </div>
            </form>

            <label className={styles.inlineForm} htmlFor="salaryShowHistory">
                <input
                    id="salaryShowHistory"
                    type="checkbox"
                    checked={showHistory}
                    onChange={(event) => setShowHistory(event.target.checked)}
                />
                Mostrar sueldos anteriores y programados
            </label>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <caption className={styles.srOnly}>
                        {showHistory ? "Todos los sueldos" : "Sueldos vigentes"}
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Empleado</th>
                            <th scope="col" className={styles.numeric}>Sueldo mensual</th>
                            <th scope="col" className={styles.numeric}>Cargas</th>
                            <th scope="col" className={styles.numeric}>Horas/mes</th>
                            <th scope="col" className={styles.numeric}>Costo por hora</th>
                            <th scope="col">Vigencia</th>
                            <th scope="col">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleSalaries.length === 0 ? (
                            <tr>
                                <td colSpan={7} className={styles.emptyState}>
                                    {showHistory
                                        ? "Todavía no cargaste ningún sueldo."
                                        : "No hay sueldos vigentes. Cargá uno con el formulario de arriba."}
                                </td>
                            </tr>
                        ) : (
                            visibleSalaries.map((salary) => (
                                <tr key={salary.id}>
                                    <td className={styles.primaryCell}>{salary.employeeName}</td>
                                    <td className={styles.numeric}>{formatCurrency(salary.monthlySalary)}</td>
                                    <td className={styles.numeric}>{formatNumber(salary.socialChargesPct)} %</td>
                                    <td className={styles.numeric}>{formatNumber(salary.monthlyHours)}</td>
                                    <td className={styles.numeric}>
                                        {formatCurrency(
                                            hourlyCost(salary.monthlySalary, salary.socialChargesPct, salary.monthlyHours),
                                        )}
                                    </td>
                                    <td>
                                        {formatDayKey(salary.validFrom)}
                                        {salary.validTo ? ` al ${formatDayKey(salary.validTo)}` : " en adelante"}
                                    </td>
                                    <td>
                                        <ValidityBadge validFrom={salary.validFrom} validTo={salary.validTo} today={today} />
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
