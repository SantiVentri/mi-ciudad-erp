"use client";

import { useState, useTransition } from "react";
import { createInvitation } from "@/app/(home)/admin/invitations/actions";

const ROLES = [
    { value: "admin", label: "Administrador" },
    { value: "driver", label: "Conductor" },
];

export default function InviteForm() {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState(ROLES[0].value);
    const [link, setLink] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
            setEmail("");
        });
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">Email a invitar:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="role">Rol:</label>
                    <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
                        {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>
                {error && <p>{error}</p>}
                <button type="submit" disabled={isPending}>
                    {isPending ? "Generando..." : "Generar invitación"}
                </button>
            </form>

            {link && (
                <div>
                    <p>Invitación creada (vence en 7 días). Compartí este link:</p>
                    <input type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
                    <button type="button" onClick={handleCopy}>
                        {copied ? "¡Copiado!" : "Copiar link"}
                    </button>
                </div>
            )}
        </div>
    );
}