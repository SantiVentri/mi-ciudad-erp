"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/modules/costs/costs.types";

// Corre una Server Action, guarda el error o el mensaje de éxito y refresca los datos
export function useCostsAction() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const run = (
        action: () => Promise<ActionResult>,
        successMessage: string,
        onSuccess?: () => void,
    ) => {
        setError("");
        setSuccess("");

        startTransition(async () => {
            const result = await action();

            if ("error" in result) {
                setError(result.error);
                return;
            }

            setSuccess(successMessage);
            onSuccess?.();
            router.refresh();
        });
    };

    return { run, isPending, error, success };
}
