"use client";

// Styles
import styles from "./inviteUser.module.css";

// Hooks
import { useState, useTransition, type FormEvent } from "react";

// Actions
import { createInvitation } from "@/app/(home)/admin/invitations/actions";

// Icons
import { UserPlus } from "lucide-react";

const ROLES = [
    { value: "driver", label: "Conductor" },
    { value: "admin", label: "Administrador" },
];

export default function InviteUserButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState(ROLES[0].value);
    const [link, setLink] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [isPending, startTransition] = useTransition();

    const open = () => {
        setEmail("");
        setRole(ROLES[0].value);
        setLink("");
        setError("");
        setCopied(false);
        setIsOpen(true);
    };

    const close = () => setIsOpen(false);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setLink("");
        setCopied(false);

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
        <>
            <button type="button" className={styles.inviteButton} onClick={open}>
                <UserPlus size={18} />
                Invitar usuario
            </button>

            {isOpen && (
                <div className={styles.modalOverlay} onClick={close} role="presentation">
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
                                    {ROLES.map((r) => (
                                        <option key={r.value} value={r.value}>
                                            {r.label}
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
                                        <button type="button" className={styles.secondaryButton} onClick={close}>
                                            Cerrar
                                        </button>
                                        <button type="button" className={styles.primaryButton} onClick={handleCopy}>
                                            {copied ? "¡Copiado!" : "Copiar link"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button type="button" className={styles.secondaryButton} onClick={close}>
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
            )}
        </>
    );
}
