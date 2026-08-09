import styles from "@/components/ui/driver/home/stopCard/stopCard.module.css";

export const STOP_STATE_STYLES: Record<string, string> = {
  Pendiente: styles.statePendiente,
  Completada: styles.stateCompletada,
};

export const DIRECCION_EMBOTELLADORA = process.env.NEXT_PUBLIC_COMPANY_ADDRESS;