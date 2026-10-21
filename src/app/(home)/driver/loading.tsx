// Styles
import styles from "./loading.module.css";

// Components
import Skeleton from "@/components/ui/skeleton/Skeleton";

// Se muestra al instante al navegar entre pantallas del conductor, mientras el servidor trae los datos
export default function DriverLoading() {
    return (
        <div className={styles.container} aria-busy="true" aria-label="Cargando">
            <header className={styles.header}>
                <Skeleton width="60%" height="28px" />
                <Skeleton width="45%" height="18px" />
            </header>
            <div className={styles.list}>
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className={styles.card}>
                        <Skeleton width="60px" height="60px" radius="10px" />
                        <div className={styles.cardInfo}>
                            <Skeleton width="70%" height="16px" />
                            <Skeleton width="50%" height="14px" />
                            <Skeleton width="40%" height="14px" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
