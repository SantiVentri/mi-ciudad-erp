"use client";

// Hooks
import { useState, type FormEvent } from "react";

// Styles
import styles from "./transports.module.css";

type DriverInviteModalProps = {
    error: string;
    link: string;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (formData: FormData) => void;
};

export default function DriverInviteModal({ error, link, isPending, onClose, onSubmit }: DriverInviteModalProps) {
    const [email, setEmail] = useState("");
    const [copied, setCopied] = useState(false);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData();
        formData.set("email", email);

        onSubmit(formData);
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="driver-invite-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="driver-invite-title">Nuevo conductor</h3>
                    <p>Se genera un link de invitación para que el conductor complete su registro.</p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.modalField}>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="conductor@ejemplo.com"
                            required
                        />
                    </label>

                    {error && <p className={styles.modalError}>{error}</p>}

                    {link && (
                        <p className={styles.modalSuccess}>
                            Invitación creada (vence en 7 días). Compartí este link: {link}
                        </p>
                    )}

                    <div className={styles.modalActions}>
                        {link ? (
                            <button type="button" className={styles.secondaryButton} onClick={handleCopy}>
                                {copied ? "¡Copiado!" : "Copiar link"}
                            </button>
                        ) : (
                            <button type="button" className={styles.secondaryButton} onClick={onClose}>
                                Cancelar
                            </button>
                        )}
                        <button type="submit" className={styles.primaryButton} disabled={isPending}>
                            {isPending ? "Generando..." : "Generar invitación"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
