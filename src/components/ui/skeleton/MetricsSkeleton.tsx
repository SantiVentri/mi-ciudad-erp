// Styles
import styles from "./skeleton.module.css";

// Components
import Skeleton from "./Skeleton";

// Mismo layout que los bloques de métricas de admin: grilla 2x2 + gráfico al costado
export default function MetricsSkeleton() {
    return (
        <div className={styles.metricsContainer}>
            <div className={styles.metricsGrid}>
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className={styles.metricCard}>
                        <Skeleton width="60%" height="14px" />
                        <Skeleton width="40%" height="30px" />
                        <Skeleton width="85%" height="13px" />
                    </div>
                ))}
            </div>
            <div className={styles.chartCard}>
                <Skeleton width="30%" height="14px" />
                <Skeleton height="auto" className={styles.chartBody} />
            </div>
        </div>
    );
}
