"use client";

// Styles
import styles from "./invitations.module.css";

// Hooks
import { useState, useTransition, type FormEvent } from "react";

// Actions
import { createInvitation } from "@/app/(home)/admin/invitations/actions";

// Constants
import { ROLE_OPTIONS } from "@/modules/invitations/invitations.constants";

type InviteUserModalProps = {
    onClose: () => void;
};

export default function InviteUserModal({ onClose }: InviteUserModalProps) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState(ROLE_OPTIONS[0].value);
    const [link, setLink] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");

        const formData = new FormData();
        formData.set("email", email);
        formData.set("role", role);

        startTransition(async () => {
            const result = await createInvitation(formData);
            if (result.error) {
                setError(result.error);
                return;
            }
            setLink(result.link ?? "");
        });
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
                aria-labelledby="invite-user-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id="invite-user-title">Invitar usuario</h3>
                    <p>Se genera un link para que la persona complete su registro.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <label className={styles.modalField}>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@ejemplo.com"
                            disabled={Boolean(link)}
                            required
                        />
                    </label>

                    <label className={styles.modalField}>
                        Rol
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            disabled={Boolean(link)}
                        >
                            {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    {error && <p className={styles.modalError}>{error}</p>}

                    {link && (
                        <p className={styles.modalSuccess}>
                            Invitación creada (vence en 7 días). Compartí este link: {link}
                        </p>
                    )}

                    <div className={styles.modalActions}>
                        {link ? (
                            <>
                                <button type="button" className={styles.secondaryButton} onClick={onClose}>
                                    Cerrar
                                </button>
                                <button type="button" className={styles.primaryButton} onClick={handleCopy}>
                                    {copied ? "¡Copiado!" : "Copiar link"}
                                </button>
                            </>
                        ) : (
                            <>
                                <button type="button" className={styles.secondaryButton} onClick={onClose}>
                                    Cancelar
                                </button>
                                <button type="submit" className={styles.primaryButton} disabled={isPending}>
                                    {isPending ? "Generando..." : "Generar invitación"}
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
