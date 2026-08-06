"use client"

// Styles
import styles from "./forms.module.css";

// Hooks
import { useState } from "react";

// Utils
import { createClient } from "@/utils/supabase/client";

// Components
import Link from "next/link";

export default function LoginForm() {
    // Form state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Form submission state
    const [isLoading, setIsLoading] = useState(false);

    // Error state
    const [error, setError] = useState("");

    // Supabase client
    const supabase = createClient();


    const validateForm = () => {
        if (!email || !password) {
            setError("Please fill in all fields.");
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address.");
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
            <Link href="/register" className={styles.link}>
                ¿No tenés una cuenta? Regístrate
            </Link>
        </form>
    )
}