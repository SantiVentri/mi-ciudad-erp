// Styles
import styles from "./topBarChart.module.css";

// Props
type TopBarChartProps = {
    title: string;
    data: { label: string; value: number }[];
    emptyMessage?: string;
    color?: string;
};

export default function TopBarChart({
    title,
    data,
    emptyMessage = "Todavía no hay datos suficientes.",
    color = "#3454d1",
}: TopBarChartProps) {
    if (data.length === 0) {
        return (
            <div className={styles.card}>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.empty}>{emptyMessage}</p>
            </div>
        );
    }

    const maxValue = Math.max(...data.map((d) => d.value), 1);

    return (
        <div className={styles.card}>
            <h3 className={styles.title}>{title}</h3>
            <div className={styles.chart}>
                {data.map((item) => {
                    const heightPct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;

                    return (
                        <div key={item.label} className={styles.col}>
                            <div className={styles.barTrack}>
                                <div
                                    className={styles.bar}
                                    style={{ height: `${heightPct}%`, background: color }}
                                >
                                    <span className={styles.value}>{item.value}</span>
                                </div>
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