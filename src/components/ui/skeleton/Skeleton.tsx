// Styles
import styles from "./skeleton.module.css";

type SkeletonProps = {
    width?: string;
    height?: string;
    radius?: string;
    className?: string;
};

// Bloque gris con brillo animado para ocupar el lugar del contenido mientras carga
export default function Skeleton({ width = "100%", height = "1rem", radius = "8px", className }: SkeletonProps) {
    return (
        <div
            aria-hidden="true"
            className={className ? `${styles.skeleton} ${className}` : styles.skeleton}
            style={{ width, height, borderRadius: radius }}
        />
    );
}
