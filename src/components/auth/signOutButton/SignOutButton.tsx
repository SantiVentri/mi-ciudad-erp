'use client';

import { createClient } from "@/utils/supabase/client";
import { useState } from "react";

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
        setIsLoading(false);
        window.location.href = "/";
    };

    return (
        <button onClick={handleSignOut}>
            {isLoading ? "Cerrando sesión..." : "Cerrar sesión"}
        </button>
    )
}
