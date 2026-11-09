"use client";

// Styles
import styles from "./stock.module.css";

// Hooks
import { useRef, useState, type KeyboardEvent } from "react";

// Components
import ProductsPanel from "./ProductsPanel";
import MovementsPanel from "./MovementsPanel";
import PriceHistoryPanel from "./PriceHistoryPanel";

// Constants and types
import { STOCK_TABS } from "@/modules/stock/stock.constants";
import type { PriceChange, Product, StockMovement, StockTabId } from "@/modules/stock/stock.types";

// Icons
import { ArrowDownUp, Package, Tags } from "lucide-react";

type StockViewProps = {
    products: Product[];
    movements: StockMovement[];
    priceHistory: PriceChange[];
};

const TAB_ICONS: Record<StockTabId, React.ReactNode> = {
    productos: <Package size={16} aria-hidden="true" />,
    movimientos: <ArrowDownUp size={16} aria-hidden="true" />,
    precios: <Tags size={16} aria-hidden="true" />,
};

export default function StockView({ products, movements, priceHistory }: StockViewProps) {
    const [activeTab, setActiveTab] = useState<StockTabId>("productos");
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const counts: Record<StockTabId, number | null> = {
        productos: products.length,
        movimientos: null,
        precios: null,
    };

    // Patrón de tabs de WAI-ARIA: flechas, Inicio y Fin mueven la selección
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = STOCK_TABS.findIndex((tab) => tab.id === activeTab);
        let nextIndex: number | null = null;

        if (event.key === "ArrowRight") nextIndex = (index + 1) % STOCK_TABS.length;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + STOCK_TABS.length) % STOCK_TABS.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = STOCK_TABS.length - 1;

        if (nextIndex === null) return;

        event.preventDefault();
        const nextTab = STOCK_TABS[nextIndex].id;
        setActiveTab(nextTab);
        tabRefs.current[nextTab]?.focus();
    };

    return (
        <div className={styles.container}>
            <div className={styles.tabs} role="tablist" aria-label="Stock">
                {STOCK_TABS.map((tab) => {
                    const selected = tab.id === activeTab;
                    const count = counts[tab.id];
                    return (
                        <button
                            key={tab.id}
                            ref={(element) => {
                                tabRefs.current[tab.id] = element;
                            }}
                            type="button"
                            role="tab"
                            id={`stock-tab-${tab.id}`}
                            aria-selected={selected}
                            aria-controls={`stock-panel-${tab.id}`}
                            tabIndex={selected ? 0 : -1}
                            className={styles.tab}
                            onClick={() => setActiveTab(tab.id)}
                            onKeyDown={handleKeyDown}
                        >
                            {TAB_ICONS[tab.id]}
                            {tab.label}
                            {count != null && <span className={styles.tabCount}>{count}</span>}
                        </button>
                    );
                })}
            </div>

            <div
                role="tabpanel"
                id={`stock-panel-${activeTab}`}
                aria-labelledby={`stock-tab-${activeTab}`}
                className={styles.panel}
            >
                {activeTab === "productos" && <ProductsPanel products={products} />}
                {activeTab === "movimientos" && <MovementsPanel movements={movements} />}
                {activeTab === "precios" && <PriceHistoryPanel priceHistory={priceHistory} />}
            </div>
        </div>
    );
}
