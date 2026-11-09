import { Suspense } from "react";
import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import MetricsSkeleton from "@/components/ui/skeleton/MetricsSkeleton";

export const metadata = {
    title: "Costos",
    description:
        "Visualizá y organizá los costos de la operación diaria.",
};

export default async function RoutesPage() {
    return (
        <div>
            <AdminPageHeader
                title="Costos"
                description="Visualizá y organizá los costos de la operación diaria."
            />
            <Suspense fallback={<MetricsSkeleton />}>
                {/* <CostsMetrics /> */}
            </Suspense>

        </div>
    );
}
