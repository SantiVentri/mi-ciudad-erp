import GrowthChart from "@/components/ui/admin/dashboard/growthChart/GrowthChart";

type OrdersGrowthChartProps = {
    data: { label: string; value: number }[];
};

export default function OrdersGrowthChart({ data }: OrdersGrowthChartProps) {
    return (
        <GrowthChart
            title={`Crecimiento de pedidos en los últimos ${data.length} meses`}
            data={data}
            emptyMessage="Todavía no hay pedidos registrados."
        />
    );
}