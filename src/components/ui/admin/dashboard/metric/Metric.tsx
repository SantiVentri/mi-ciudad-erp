// Styles
import styles from "./metric.module.css";

// Props
type MetricProps = {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    description?: string;
};

export default function Metric({ icon, title, value, description }: MetricProps) {
    return (
        <div className={styles.metric}>
            <div className={styles.header}>
                <div className={styles.icon}>{icon}</div>
                <h3 className={styles.title}>{title}</h3>
            </div>
            <div className={styles.content}>
                <p className={styles.value}>{value}</p>
                {description && <p className={styles.description}>{description}</p>}
            </div>
        </div>
    );
}