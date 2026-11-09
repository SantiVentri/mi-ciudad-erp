import { Suspense } from "react";
import AdminPageHeader from "@/components/layout/header/AdminPageHeader";
import MetricsSkeleton from "@/components/ui/skeleton/MetricsSkeleton";
import CostsMetrics from "@/modules/costs/components/CostsMetrics";
import CostsView from "@/modules/costs/components/CostsView";
import {
    getCostsMetrics,
    getFuelPrices,
    getSalaries,
    getSalaryEmployeeOptions,
    getVehiclesWithoutYield,
} from "@/modules/costs/costs.dal";
import { todayKeyAR } from "@/utils/dates/argentina";

export const metadata = {
    title: "Costos",
    description:
        "Visualizá y organizá los costos de la operación diaria.",
};

export default async function CostsPage() {
    // Las métricas se piden ya, en paralelo con el resto; CostsMetrics reusa el resultado (cache)
    getCostsMetrics().catch(() => {});

    // Cada función devuelve null si el usuario no es admin: los sueldos nunca salen de acá
    const [fuelPrices, salaries, employees, vehiclesWithoutYield] = await Promise.all([
        getFuelPrices(),
        getSalaries(),
        getSalaryEmployeeOptions(),
        getVehiclesWithoutYield(),
    ]);

    return (
        <div>
            <AdminPageHeader
                title="Costos"
                description="Visualizá y organizá los costos de la operación diaria."
            />
            <Suspense fallback={<MetricsSkeleton />}>
                <CostsMetrics />
            </Suspense>
            <CostsView
                today={todayKeyAR()}
                fuelPrices={fuelPrices ?? []}
                salaries={salaries ?? []}
                employees={employees ?? []}
                vehiclesWithoutYield={vehiclesWithoutYield ?? []}
            />
        </div>
    );
}
