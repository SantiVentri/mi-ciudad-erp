import TopBarChart from "../../dashboard/topBarChart/TopBarChart";

type TopVehiclesChartProps = {
    vehicles: { label: string; value: number }[];
};

export default function TopVehiclesChart({ vehicles }: TopVehiclesChartProps) {
    return (
        <TopBarChart
            title={`Top ${vehicles.length} vehículos por rutas asignadas`}
            data={vehicles}
            emptyMessage="Todavía no hay rutas asignadas."
            color="#f97316"
        />
    );
}