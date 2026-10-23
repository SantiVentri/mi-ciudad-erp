'use client';

// Styles
import styles from "./signOutButton.module.css";

// Hooks
import { useState } from "react";
import { useRouter } from "next/navigation";

// Utils
import { createClient } from "@/utils/supabase/client";

// Icons
import { LogOut } from "lucide-react";

type SignOutButtonProps = {
    // Con texto "Cerrar sesión" (perfil del conductor); sin él es solo el ícono (menú del admin)
    showLabel?: boolean;
};

export default function SignOutButton({ showLabel = false }: SignOutButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const supabase = createClient();

    const handleSignOut = async () => {
        setIsLoading(true);
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Error signing out:", error.message);
            setIsLoading(false);
            return;
        }
        router.replace("/login");
        router.refresh();
    };

    return (
        <button
            className={`${styles.button} ${showLabel ? styles.withLabel : ""} ${isLoading ? styles.loading : ""}`}
            onClick={handleSignOut}
            disabled={isLoading}
            aria-label="Cerrar sesión"
        >
            <LogOut size={20} />
            {showLabel && (isLoading ? "Cerrando sesión..." : "Cerrar sesión")}
        </button>
    )
}
