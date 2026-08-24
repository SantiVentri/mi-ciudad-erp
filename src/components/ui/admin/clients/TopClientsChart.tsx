import TopBarChart from "../dashboard/topBarChart/TopBarChart";

// Props
type TopClientsChartProps = {
    clients: { label: string; value: number }[];
};

export default function TopClientsChart({ clients }: TopClientsChartProps) {
    return (
        <TopBarChart
            title={`Top ${clients.length} clientes por pedidos`}
            data={clients}
            emptyMessage="Todavía no hay pedidos registrados."
        />
    );
}