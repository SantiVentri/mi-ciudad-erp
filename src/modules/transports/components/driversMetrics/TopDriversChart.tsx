import TopBarChart from "@/components/ui/admin/dashboard/topBarChart/TopBarChart";

type TopDriversChartProps = {
    drivers: { label: string; value: number }[];
};

export default function TopDriversChart({ drivers }: TopDriversChartProps) {
    return (
        <TopBarChart
            title={`Top ${drivers.length} conductores por rutas asignadas`}
            data={drivers}
            emptyMessage="Todavía no hay rutas asignadas."
            color="#10b981"
        />
    );
}