"use client"

// Styles
import styles from "./forms.module.css";

// Hooks
import { useState } from "react";

// Utils
import { createClient } from "@/utils/supabase/client";

// Icons
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm() {
    // Form state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Form submission state
    const [isLoading, setIsLoading] = useState(false);

    // Error state
    const [error, setError] = useState("");

    // Supabase client
    const supabase = createClient();

    const validateForm = () => {
        if (!email || !password) {
            setError("Completá todos los campos.");
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("El email no es válido.");
            return false;
        }

        return true;
    }

    const resetForm = () => {
        setEmail("");
        setPassword("");
        setError("");
    }

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        setIsLoading(true);
        setError("");

        if (!validateForm()) {
            setIsLoading(false);
            return;
        }

        const { error: logInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        })

        if (logInError) {
            console.log("Error: No se pudo iniciar sesión. ", logInError)
            setError("No se pudo iniciar sesión. Por favor, revisá tus credenciales e intentá nuevamente.");
            setIsLoading(false);
            return;
        }

        window.location.reload();

        setIsLoading(false);
        resetForm();
    }

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
                <label htmlFor="email">Email:</label>
                <input
                    type="email"
                    id="email"
                    placeholder="ej: juan@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="password">Contraseña:</label>
                <div className={styles.inputContainer}>
                    <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        placeholder="ej: Juan1234"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="button" onClick={(e) => {
                        e.preventDefault();
                        setShowPassword(!showPassword)
                    }}>
                        {showPassword ? (
                            <Eye />
                        ) : (
                            <EyeOff />
                        )}
                    </button>
                </div>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" disabled={isLoading}>
                {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
        </form>
    )
}