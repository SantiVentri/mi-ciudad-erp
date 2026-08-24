import { useId } from "react";
import styles from "./growthChart.module.css";

type GrowthChartProps = {
    title: string;
    data: { label: string; value: number }[];
    color?: string;
    emptyMessage?: string;
};

const WIDTH = 600;
const HEIGHT = 160;
const PADDING_X = 24;
const PADDING_TOP = 32;
const PADDING_BOTTOM = 28;

export default function GrowthChart({
    title,
    data,
    color = "#3454d1",
    emptyMessage = "Todavía no hay datos suficientes.",
}: GrowthChartProps) {
    const gradientId = `growthChartFill-${useId()}`;

    if (data.length === 0) {
        return (
            <div className={styles.card}>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.empty}>{emptyMessage}</p>
            </div>
        );
    }

    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    const stepX = data.length > 1 ? (WIDTH - PADDING_X * 2) / (data.length - 1) : 0;

    const points = data.map((d, i) => ({
        ...d,
        x: PADDING_X + i * stepX,
        y: PADDING_TOP + (1 - d.value / maxValue) * chartHeight,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    const baseline = HEIGHT - PADDING_BOTTOM;
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;

    return (
        <div className={styles.card}>
            <h3 className={styles.title}>{title}</h3>
            <svg className={styles.svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>

                <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
                <path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {points.map((p) => (
                    <g key={p.label}>
                        <circle cx={p.x} cy={p.y} r={4} fill={color} stroke="#ffffff" strokeWidth="2" />
                        <text x={p.x} y={p.y - 14} textAnchor="middle" className={styles.value}>
                            {p.value}
                        </text>
                        <text x={p.x} y={HEIGHT - 8} textAnchor="middle" className={styles.label}>
                            {p.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}