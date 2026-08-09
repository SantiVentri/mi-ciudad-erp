'use client';

// Styles
import styles from "./routeDetails.module.css";

interface Stop {
    id: string | number;
    orderId: string | number;
    visitOrder: number;
    state: string;
}

interface Route {
    id: string | number;
    driverId: string;
    vehicleId: string | number;
    state: string;
    stops?: Stop[];
}

interface RouteDetailsProps {
    currentRoute: Route | null;
}

export default function RouteDetails({ currentRoute }: RouteDetailsProps) {
    if (!currentRoute) {
        return <div className={styles.container}>No hay ruta asignada actualmente.</div>;
    }

    const stops = currentRoute.stops ?? [];

    return (
        <div className={styles.container}>
            <h2>Detalles de la Ruta</h2>
            <p><strong>ID de la Ruta:</strong> {currentRoute.id}</p>
            <p><strong>ID del Conductor:</strong> {currentRoute.driverId}</p>
            <p><strong>ID del Vehículo:</strong> {currentRoute.vehicleId}</p>
            <p><strong>Estado:</strong> {currentRoute.state}</p>

            <hr />

            <h2>Paradas:</h2>
            {stops.length === 0 ? (
                <p>No hay paradas asignadas para esta ruta.</p>
            ) : (
                <ul className={styles.stopsList}>
                    {stops.map((stop) => (
                        <li key={stop.id}>
                            <p><strong>ID de la Parada:</strong> {stop.id}</p>
                            <p><strong>ID del Pedido:</strong> {stop.orderId}</p>
                            <p><strong>Orden de Visita:</strong> {stop.visitOrder}</p>
                            <p><strong>Estado:</strong> {stop.state}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}