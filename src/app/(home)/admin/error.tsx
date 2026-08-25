"use client";

import { useEffect } from "react";

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div style={{ padding: "3rem", textAlign: "center" }}>
            <h2>Ocurrió un error al cargar esta página</h2>
            <p style={{ color: "#666", margin: "0.5rem 0 1.5rem" }}>
                {error.message || "Algo salió mal. Probá de nuevo en unos segundos."}
            </p>
            <button onClick={() => reset()}>Reintentar</button>
        </div>
    );
}