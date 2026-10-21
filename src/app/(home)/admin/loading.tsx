// Styles
import styles from "./loading.module.css";

// Components
import Skeleton from "@/components/ui/skeleton/Skeleton";
import MetricsSkeleton from "@/components/ui/skeleton/MetricsSkeleton";

// Se muestra al instante al navegar entre secciones del admin, mientras el servidor trae los datos
export default function AdminLoading() {
    return (
        <div className={styles.container} aria-busy="true" aria-label="Cargando">
            <header className={styles.header}>
                <Skeleton width="220px" height="2.15rem" />
                <Skeleton width="420px" height="1rem" />
            </header>
            <MetricsSkeleton />
            <div className={styles.toolbar}>
                <Skeleton width="280px" height="40px" radius="10px" />
                <Skeleton width="140px" height="40px" radius="10px" />
            </div>
            <div className={styles.list}>
                {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} height="72px" radius="12px" />
                ))}
            </div>
        </div>
    );
}
