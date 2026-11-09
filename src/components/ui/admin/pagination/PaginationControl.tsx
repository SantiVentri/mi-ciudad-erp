// Styles
import styles from "./paginationControl.module.css";

type PaginationControlProps = {
    currentPage: number;
    setCurrentPage: (page: number) => void;
    totalPages: number;
};

// Páginas vecinas a la actual que se muestran a cada lado
const SIBLINGS = 1;

// Con muchas páginas no entran todos los botones: primera, última y vecinas de la
// actual, con "…" donde se saltean páginas. Ej.: 1 … 4 5 6 … 20
function getVisiblePages(currentPage: number, totalPages: number): (number | "gap")[] {
    const pages: (number | "gap")[] = [];

    for (let page = 1; page <= totalPages; page++) {
        const isEdge = page === 1 || page === totalPages;
        const isNear = Math.abs(page - currentPage) <= SIBLINGS;
        // Si el salto sería de una sola página, se muestra la página en lugar del "…"
        const fillsGap =
            (page === 2 && currentPage - SIBLINGS === 3) ||
            (page === totalPages - 1 && currentPage + SIBLINGS === totalPages - 2);

        if (isEdge || isNear || fillsGap) {
            pages.push(page);
        } else if (pages[pages.length - 1] !== "gap") {
            pages.push("gap");
        }
    }

    return pages;
}

export default function PaginationControl({ currentPage, setCurrentPage, totalPages }: PaginationControlProps) {
    const pages = getVisiblePages(currentPage, totalPages);

    return (
        <div className={styles.paginationControl}>
            <button
                type="button"
                className={styles.pageButton}
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
            >
                Anterior
            </button>
            {pages.map((page, index) =>
                page === "gap" ? (
                    <span key={`gap-${index}`} className={styles.gap} aria-hidden>
                        …
                    </span>
                ) : (
                    <button
                        type="button"
                        key={page}
                        className={`${styles.pageButton} ${page === currentPage ? styles.active : ""}`}
                        onClick={() => setCurrentPage(page)}
                        aria-current={page === currentPage ? "page" : undefined}
                    >
                        {page}
                    </button>
                ),
            )}
            <button
                type="button"
                className={styles.pageButton}
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                Siguiente
            </button>
        </div>
    );
}
