import { Suspense } from "react";
import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import MetricsSkeleton from "@/components/ui/skeleton/MetricsSkeleton";
import StockMetrics from "@/modules/stock/components/StockMetrics";
import StockView from "@/modules/stock/components/StockView";
import { getPriceHistory, getProducts, getStockMovements } from "@/modules/stock/stock.dal";

export const metadata = {
    title: "Stock",
    description: "Administrá los productos, el stock disponible y los precios.",
};

export default async function StockPage() {
    // Cada función devuelve null si el usuario no es admin
    const [products, movements, priceHistory] = await Promise.all([
        getProducts(),
        getStockMovements(),
        getPriceHistory(),
    ]);

    return (
        <div>
            <AdminPageHeader
                title="Stock"
                description="Administrá los productos, el stock disponible y los precios."
            />
            <Suspense fallback={<MetricsSkeleton />}>
                <StockMetrics />
            </Suspense>
            <StockView
                products={products ?? []}
                movements={movements ?? []}
                priceHistory={priceHistory ?? []}
            />
        </div>
    );
}
