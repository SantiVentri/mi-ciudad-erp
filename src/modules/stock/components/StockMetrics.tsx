// Styles
import styles from "./stock.module.css";

// Components
import Metric from "@/components/ui/admin/dashboard/metric/Metric";
import TopBarChart from "@/components/ui/admin/dashboard/topBarChart/TopBarChart";

// Data and utils
import { getProducts } from "@/modules/stock/stock.dal";
import { formatCurrency } from "@/modules/costs/costs.utils";
import { getStockLevel } from "@/modules/stock/stock.utils";

// Icons
import { Boxes, CircleDollarSign, Package, TriangleAlert } from "lucide-react";

const numberFormatter = new Intl.NumberFormat("es-AR");

// Lista corta de nombres: "Bidón 20 Litros, Sifón de Soda 1.5L y 2 más"
function namesSummary(names: string[], max = 2) {
    if (names.length <= max) return names.join(" y ");
    return `${names.slice(0, max).join(", ")} y ${names.length - max} más`;
}

export default async function StockMetrics() {
    // Misma consulta que la tabla (cache de React): no se repite
    const products = (await getProducts()) ?? [];

    const active = products.filter((product) => product.isActive);
    const disabledCount = products.length - active.length;

    const outOfStock = active.filter((product) => getStockLevel(product) === "out");
    const lowStock = active.filter((product) => getStockLevel(product) === "low");
    const alerts = [...outOfStock, ...lowStock];

    const totalUnits = products.reduce((sum, product) => sum + product.stock, 0);
    const inventoryValue = products.reduce((sum, product) => sum + product.stock * product.price, 0);
    const committedUnits = products.reduce((sum, product) => sum + product.committedUnits, 0);

    const demand = [...products]
        .filter((product) => product.unitsLast30d > 0)
        .sort((a, b) => b.unitsLast30d - a.unitsLast30d)
        .slice(0, 6)
        .map((product) => ({ label: product.name, value: product.unitsLast30d }));

    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                <Metric
                    icon={<Package size={15} />}
                    title="Productos activos"
                    value={active.length}
                    description={
                        disabledCount > 0
                            ? `${disabledCount} ${disabledCount === 1 ? "deshabilitado" : "deshabilitados"}`
                            : "Todos se pueden pedir"
                    }
                />
                <Metric
                    icon={<TriangleAlert size={15} />}
                    title="Stock bajo o agotado"
                    value={alerts.length}
                    description={
                        alerts.length > 0
                            ? namesSummary(alerts.map((product) => product.name))
                            : "Todo por encima del mínimo"
                    }
                />
                <Metric
                    icon={<CircleDollarSign size={15} />}
                    title="Valor del inventario"
                    value={formatCurrency(Math.round(inventoryValue))}
                    description={`${numberFormatter.format(totalUnits)} unidades a precio de lista`}
                />
                <Metric
                    icon={<Boxes size={15} />}
                    title="Por entregar"
                    value={numberFormatter.format(committedUnits)}
                    description="Unidades en pedidos pendientes o asignados"
                />
            </div>
            <div className={styles.chartSlot}>
                <TopBarChart
                    title="Unidades pedidas por producto (últimos 30 días)"
                    data={demand}
                    emptyMessage="Todavía no hay pedidos en los últimos 30 días."
                />
            </div>
        </div>
    );
}
