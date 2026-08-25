// Styles
import styles from "./paginationControl.module.css";

type PaginationControlProps = {
    currentPage: number;
    setCurrentPage: (page: number) => void;
    totalPages: number;
};

export default function PaginationControl({ currentPage, setCurrentPage, totalPages }: PaginationControlProps) {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <div className={styles.paginationControl}>
            <button
                className={styles.pageButton}
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
            >
                Anterior
            </button>
            {pages.map((page) => (
                <button
                    key={page}
                    className={`${styles.pageButton} ${page === currentPage ? styles.active : ""}`}
                    onClick={() => setCurrentPage(page)}
                >
                    {page}
                </button>
            ))}
            <button
                className={styles.pageButton}
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                Siguiente
            </button>
        </div>
    );
}