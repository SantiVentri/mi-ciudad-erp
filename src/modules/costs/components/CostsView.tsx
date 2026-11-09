"use client";

// Styles
import styles from "./costs.module.css";

// Hooks
import { useRef, useState, type KeyboardEvent } from "react";

// Components
import Link from "next/link";
import FuelPricesPanel from "./FuelPricesPanel";
import SalariesPanel from "./SalariesPanel";

// Constants and types
import { COSTS_TABS } from "@/modules/costs/costs.constants";
import type { CostsTabId, EmployeeOption, FuelPrice, Salary } from "@/modules/costs/costs.types";

// Icons
import { Fuel, Wallet } from "lucide-react";

// Solo se renderiza en /admin/costs (admin): es el único lugar donde llegan sueldos al cliente
type CostsViewProps = {
    today: string;
    fuelPrices: FuelPrice[];
    salaries: Salary[];
    employees: EmployeeOption[];
    vehiclesWithoutYield: string[];
};

const TAB_ICONS: Record<CostsTabId, React.ReactNode> = {
    combustible: <Fuel size={16} aria-hidden="true" />,
    sueldos: <Wallet size={16} aria-hidden="true" />,
};

export default function CostsView({
    today,
    fuelPrices,
    salaries,
    employees,
    vehiclesWithoutYield,
}: CostsViewProps) {
    const [activeTab, setActiveTab] = useState<CostsTabId>("combustible");
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const counts: Record<CostsTabId, number> = {
        combustible: fuelPrices.length,
        sueldos: salaries.filter((salary) => salary.validTo === null).length,
    };

    // Patrón de tabs de WAI-ARIA: flechas, Inicio y Fin mueven la selección
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = COSTS_TABS.findIndex((tab) => tab.id === activeTab);
        let nextIndex: number | null = null;

        if (event.key === "ArrowRight") nextIndex = (index + 1) % COSTS_TABS.length;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + COSTS_TABS.length) % COSTS_TABS.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = COSTS_TABS.length - 1;

        if (nextIndex === null) return;

        event.preventDefault();
        const nextTab = COSTS_TABS[nextIndex].id;
        setActiveTab(nextTab);
        tabRefs.current[nextTab]?.focus();
    };

    return (
        <div className={styles.container}>
            {vehiclesWithoutYield.length > 0 && (
                <p className={styles.warning}>
                    Sin rendimiento cargado: <strong>{vehiclesWithoutYield.join(", ")}</strong>. No se
                    puede calcular el costo de las rutas que usen estos vehículos.{" "}
                    <Link href="/admin/transports" className={styles.inlineLink}>
                        Cargalo en Transportes
                    </Link>
                    .
                </p>
            )}

            <div className={styles.tabs} role="tablist" aria-label="Configuración de costos">
                {COSTS_TABS.map((tab) => {
                    const selected = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            ref={(element) => {
                                tabRefs.current[tab.id] = element;
                            }}
                            type="button"
                            role="tab"
                            id={`costs-tab-${tab.id}`}
                            aria-selected={selected}
                            aria-controls={`costs-panel-${tab.id}`}
                            tabIndex={selected ? 0 : -1}
                            className={styles.tab}
                            onClick={() => setActiveTab(tab.id)}
                            onKeyDown={handleKeyDown}
                        >
                            {TAB_ICONS[tab.id]}
                            {tab.label}
                            <span className={styles.tabCount}>{counts[tab.id]}</span>
                        </button>
                    );
                })}
            </div>

            <div
                role="tabpanel"
                id={`costs-panel-${activeTab}`}
                aria-labelledby={`costs-tab-${activeTab}`}
                tabIndex={0}
                className={styles.panel}
            >
                {activeTab === "combustible" && <FuelPricesPanel today={today} fuelPrices={fuelPrices} />}
                {activeTab === "sueldos" && (
                    <SalariesPanel today={today} salaries={salaries} employees={employees} />
                )}
            </div>
        </div>
    );
}
