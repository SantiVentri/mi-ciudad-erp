// Styles
import styles from "./topClients.module.css";

// Props
type TopClientsChartProps = {
    clients: { label: string; value: number }[]; // podría renombrarse a `data` si lo reusás en otros contextos
};

export default function TopClientsChart({ clients }: TopClientsChartProps) {
    if (clients.length === 0) {
        return (
            <div className={styles.card}>
                <h3 className={styles.title}>Top clientes por pedidos</h3>
                <p className={styles.empty}>Todavía no hay pedidos registrados.</p>
            </div>
        );
    }

    const maxValue = Math.max(...clients.map((c) => c.value));

    return (
        <div className={styles.card}>
            <h3 className={styles.title}>Top {clients.length} clientes por pedidos</h3>
            <div className={styles.chart}>
                {clients.map((item) => {
                    const heightPct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;

                    return (
                        <div key={item.label} className={styles.col}>
                            <span className={styles.value}>{item.value}</span>
                            <div className={styles.barTrack}>
                                <div className={styles.bar} style={{ height: `${heightPct}%` }} />
                            </div>
                            <span className={styles.name} title={item.label}>
                                {item.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}