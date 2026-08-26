"use client";

import { useRef } from "react";

export function useResetOnChange(deps: readonly unknown[], onChange: () => void) {
    const prevDeps = useRef(deps);

    const changed =
        deps.length !== prevDeps.current.length ||
        deps.some((dep, i) => dep !== prevDeps.current[i]);

    if (changed) {
        prevDeps.current = deps;
        onChange();
    }
}