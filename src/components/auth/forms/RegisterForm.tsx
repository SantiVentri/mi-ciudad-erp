"use client";

// Styles
import styles from "./forms.module.css";

// Hooks
import { useState } from "react";

// Utils
import { createClient } from "@/utils/supabase/client";

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

    const supabase = createClient();

    const validateForm = () => {
        if (!formEmail || !displayName || !firstName || !lastName || !password) {
            setError("Completá todos los campos.");
            return false;
        }
        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            return false;
        } else if (password.length > 20) {
            setError("La contraseña no puede tener más de 20 caracteres.");
            return false;
        } else if (!/[A-Z]/.test(password)) {
            setError("La contraseña debe tener al menos una mayúscula.");
            return false;
        } else if (!/[a-z]/.test(password)) {
            setError("La contraseña debe tener al menos una minúscula.");
            return false;
        } else if (!/[0-9]/.test(password)) {
            setError("La contraseña debe tener al menos un número.");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        if (!validateForm()) {
            setIsLoading(false);
            return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
            email: formEmail,
            password,
            options: {
                data: {
                    display_name: displayName,
                    first_name: firstName,
                    last_name: lastName,
                    ...(token ? { invite_token: token } : {}),
                },
            },
        });

        if (signUpError) {
            setError("No se pudo crear la cuenta: " + signUpError.message);
            setIsLoading(false);
            return;
        }

        const { error: logInError } = await supabase.auth.signInWithPassword({
            email: formEmail,
            password,
        });

        if (logInError) {
            setError("Cuenta creada, pero no se pudo iniciar sesión automáticamente. Andá a /login.");
            setIsLoading(false);
            return;
        }

        window.location.href = "/admin";
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