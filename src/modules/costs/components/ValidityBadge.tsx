// Styles
import styles from "./costs.module.css";

// Utils
import { getValidityStatus } from "@/modules/costs/costs.utils";

type ValidityBadgeProps = {
    validFrom: string;
    validTo: string | null;
    today: string;
};

const LABELS = {
    current: "Vigente",
    scheduled: "Programado",
    past: "Anterior",
} as const;

export default function ValidityBadge({ validFrom, validTo, today }: ValidityBadgeProps) {
    const status = getValidityStatus(validFrom, validTo, today);
    const tone =
        status === "current" ? styles.badgeSuccess : status === "scheduled" ? styles.badgeInfo : "";

    return <span className={`${styles.badge} ${tone}`}>{LABELS[status]}</span>;
}
