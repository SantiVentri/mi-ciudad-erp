"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/modules/stock/stock.types";

// Corre una Server Action, guarda el error y refresca los datos si salió bien.
// onSuccess recibe el mensaje que devolvió la acción (si devolvió alguno).
export function useStockAction() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");

    const run = (action: () => Promise<ActionResult>, onSuccess?: (message?: string) => void) => {
        setError("");

        startTransition(async () => {
            const result = await action();

            if ("error" in result) {
                setError(result.error);
                return;
            }

            onSuccess?.(result.message);
            router.refresh();
        });
    };

    return { run, isPending, error, setError };
}
