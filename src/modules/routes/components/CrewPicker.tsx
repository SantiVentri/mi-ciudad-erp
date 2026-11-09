"use client";

// Styles
import styles from "./routes.module.css";

// Hooks
import { useEffect, useRef, useState } from "react";

// Types
import type {
    Recommendation,
    RecommendationTag,
} from "@/modules/routes/routes.recommendations";

// Icons
import { ChevronDown, Star } from "lucide-react";

type CrewPickerProps = {
    id: string;
    label: string;
    placeholder: string;
    options: Recommendation[];
    value: string;
    onChange: (id: string) => void;
};

const TONE_STYLES: Record<RecommendationTag["tone"], string> = {
    positive: styles.tagPositive,
    neutral: styles.tagNeutral,
    warning: styles.tagWarning,
};

function TagList({ tags }: { tags: RecommendationTag[] }) {
    if (tags.length === 0) return null;

    return (
        <span className={styles.tagList}>
            {tags.map((tag) => (
                <span key={tag.label} className={`${styles.tag} ${TONE_STYLES[tag.tone]}`}>
                    {tag.label}
                </span>
            ))}
        </span>
    );
}

/**
 * Select con recomendaciones: cada opción muestra su carga reciente y los motivos
 * (tags) por los que conviene o no elegirla. La lista se despliega dentro del modal
 * (no flota) para que no la recorte el scroll del modal.
 */
export default function CrewPicker({
    id,
    label,
    placeholder,
    options,
    value,
    onChange,
}: CrewPickerProps) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selected = options.find((option) => option.id === value);
    const labelId = `${id}-label`;
    const listId = `${id}-listbox`;
    const optionId = (index: number) => `${id}-option-${index}`;

    const openList = () => {
        // Arranca sobre lo elegido; si no hay nada, sobre el sugerido
        const selectedIndex = options.findIndex((option) => option.id === value);
        const suggestedIndex = options.findIndex((option) => option.suggested);
        setActiveIndex(Math.max(selectedIndex >= 0 ? selectedIndex : suggestedIndex, 0));
        setOpen(true);
    };

    const close = (focusTrigger: boolean) => {
        setOpen(false);
        if (focusTrigger) triggerRef.current?.focus();
    };

    const choose = (index: number) => {
        const option = options[index];
        if (!option) return;
        onChange(option.id);
        close(true);
    };

    useEffect(() => {
        if (!open) return;
        listRef.current?.focus();

        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        document
            .getElementById(`${id}-option-${activeIndex}`)
            ?.scrollIntoView({ block: "nearest" });
    }, [open, activeIndex, id]);

    const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
        const last = options.length - 1;

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, last));
                break;
            case "ArrowUp":
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
                break;
            case "Home":
                event.preventDefault();
                setActiveIndex(0);
                break;
            case "End":
                event.preventDefault();
                setActiveIndex(last);
                break;
            case "Enter":
            case " ":
                event.preventDefault();
                choose(activeIndex);
                break;
            case "Escape":
                event.preventDefault();
                event.stopPropagation();
                close(true);
                break;
            case "Tab":
                close(false);
                break;
        }
    };

    return (
        <div className={styles.modalField} ref={containerRef}>
            <span id={labelId}>{label}</span>

            <button
                ref={triggerRef}
                type="button"
                id={id}
                className={styles.pickerTrigger}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-labelledby={`${labelId} ${id}`}
                onClick={() => (open ? close(false) : openList())}
                onKeyDown={(event) => {
                    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                        event.preventDefault();
                        openList();
                    }
                }}
            >
                {selected ? (
                    <span className={styles.pickerValue}>
                        {selected.label}
                        {selected.suggested && (
                            <Star size={14} className={styles.pickerStar} aria-label="Sugerido" />
                        )}
                    </span>
                ) : (
                    <span className={styles.pickerPlaceholder}>{placeholder}</span>
                )}
                <ChevronDown
                    size={18}
                    className={`${styles.pickerChevron} ${open ? styles.pickerChevronOpen : ""}`}
                    aria-hidden
                />
            </button>

            {!open && selected && <TagList tags={selected.tags} />}

            {open && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    tabIndex={-1}
                    aria-labelledby={labelId}
                    aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
                    className={styles.pickerList}
                    onKeyDown={handleListKeyDown}
                >
                    {options.length === 0 && (
                        <li className={styles.pickerEmpty}>No hay opciones disponibles.</li>
                    )}
                    {options.map((option, index) => (
                        <li
                            key={option.id}
                            id={optionId(index)}
                            role="option"
                            aria-selected={option.id === value}
                            className={[
                                styles.pickerOption,
                                index === activeIndex ? styles.pickerOptionActive : "",
                                option.id === value ? styles.pickerOptionSelected : "",
                            ].join(" ")}
                            onClick={() => choose(index)}
                            onPointerMove={() => setActiveIndex(index)}
                        >
                            <span className={styles.pickerOptionHeader}>
                                <span className={styles.pickerOptionName}>{option.label}</span>
                                {option.suggested && (
                                    <span className={styles.suggestedBadge}>
                                        <Star size={12} aria-hidden /> Sugerido
                                    </span>
                                )}
                            </span>
                            {option.summary && (
                                <span className={styles.pickerOptionSummary}>{option.summary}</span>
                            )}
                            <TagList tags={option.tags} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
