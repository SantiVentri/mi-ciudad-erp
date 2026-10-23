"use client";

import { useState } from "react";

// Guarda las deps anteriores en estado (no en un ref) para poder compararlas
// durante el render, como recomienda React para ajustar estado cuando cambian props
export function useResetOnChange(deps: readonly unknown[], onChange: () => void) {
    const [prevDeps, setPrevDeps] = useState(deps);

    const changed =
        deps.length !== prevDeps.length ||
        deps.some((dep, i) => dep !== prevDeps[i]);

    if (changed) {
        setPrevDeps(deps);
        onChange();
    }
}
