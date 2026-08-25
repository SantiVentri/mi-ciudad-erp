"use client";

// Styles
import styles from "./forms.module.css";

// Hooks
import { useState } from "react";

// Actions
import { registerUser } from "@/modules/auth/auth.actions";

export default function RegisterForm({
    email,
    token,
}: {
    email?: string;
    token?: string;
}) {
    const [formEmail, setFormEmail] = useState(email ?? "");
    const [displayName, setDisplayName] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Solo para feedback instantáneo en el navegador — la validación real está en registerUser().
    const quickClientCheck = () => {
        if (!formEmail || !displayName || !firstName || !lastName || !password) {
            setError("Completá todos los campos.");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        if (!quickClientCheck()) {
            setIsLoading(false);
            return;
        }

        const result = await registerUser({
            email: formEmail,
            displayName,
            firstName,
            lastName,
            password,
            token,
        });

        if (result.error) {
            setError(result.error);
            setIsLoading(false);
            return;
        }

        window.location.href = result.redirectTo ?? "/admin";
    };

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
                <label htmlFor="email">Email:</label>
                <input
                    type="email"
                    id="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    disabled={Boolean(email)}
                    readOnly={Boolean(email)}
                    required
                />
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="displayName">Nombre de usuario:</label>
                <input
                    type="text"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                />
            </div>
            <div className={styles.formRow}>
                <div className={styles.formGroup}>
                    <label htmlFor="firstName">Primer nombre:</label>
                    <input
                        type="text"
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="lastName">Apellido:</label>
                    <input
                        type="text"
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                    />
                </div>
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="password">Contraseña:</label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" disabled={isLoading}>
                {isLoading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
        </form>
    );
}