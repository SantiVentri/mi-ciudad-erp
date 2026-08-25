'use client';

// Styles
import styles from "./signOutButton.module.css";

// Hooks
import { useState } from "react";

// Utils
import { createClient } from "@/utils/supabase/client";

// Icons
import { LogOut } from "lucide-react";

export default function SignOutButton() {
    const [isLoading, setIsLoading] = useState(false);

    const supabase = createClient();

    const handleSignOut = async () => {
        setIsLoading(true);
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Error signing out:", error.message);
            setIsLoading(false);
            return;
        }
        window.location.href = "/";
    };

    return (
        <button
            className={`${styles.button} ${isLoading ? styles.loading : ""}`}
            onClick={handleSignOut}
            disabled={isLoading}
            aria-label="Cerrar sesión"
        >
            <LogOut size={20} />
        </button>
    )
}
