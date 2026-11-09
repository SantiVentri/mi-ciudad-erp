import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import MetricsSkeleton from "@/components/ui/skeleton/MetricsSkeleton";
import { Suspense } from "react";

export const metadata = {
    title: "Facturación",
    description:
        "Visualizá y organizá la facturación de la operación diaria.",
};

export default async function CostsPage() {
    return (
        <div>
            <AdminPageHeader
                title="Facturación"
                description="Visualizá y organizá la facturación de la operación diaria."
            />
            <Suspense fallback={<MetricsSkeleton />}>
                {/* <FacturationMetrics /> */}
            </Suspense>

        </div>
    );
}
