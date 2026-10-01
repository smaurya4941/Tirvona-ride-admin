import { useState } from "react";

/**
 * Categorical slots validated with the dataviz palette checker (light
 * surface): blue, orange, aqua. Aqua is under 3:1 against white, so every
 * chart ships a legend and the pages show the same numbers in a table.
 */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"] as const;

export interface Series {
  key: string;
  label: string;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/**
 * Grouped column chart over days, one y-axis, up to three series, with a
 * per-day hover tooltip. Data are rows of `{ date, [series.key]: number }`.
 */
export function DayColumns({
  rows,
  series,
  format = (value: number) => value.toLocaleString("en-IN"),
  height = 200,
  label,
}: {
  rows: Array<{ date: string } & Record<string, number | string>>;
  series: Series[];
  format?: (value: number) => string;
  height?: number;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const padding = { top: 12, right: 8, bottom: 26, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = rows.flatMap((row) => series.map((entry) => Number(row[entry.key]) || 0));
  const max = niceMax(Math.max(0, ...values));
  const band = plotWidth / Math.max(1, rows.length);
  const groupWidth = Math.min(band * 0.7, 18 * series.length + 2 * (series.length - 1));
  const barWidth = (groupWidth - 2 * (series.length - 1)) / series.length;
  const y = (value: number) => padding.top + plotHeight - (value / max) * plotHeight;
  const labelEvery = Math.ceil(rows.length / 10);
  const hovered = hover === null ? null : rows[hover];

  return (
    <figure className="relative">
      {series.length > 1 && (
        <figcaption className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((entry, index) => (
            <span key={entry.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[index] }} aria-hidden />
              {entry.label}
            </span>
          ))}
        </figcaption>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line x1={padding.left} x2={width - padding.right} y1={y(max * fraction)} y2={y(max * fraction)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padding.left - 6} y={y(max * fraction) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
              {format(max * fraction)}
            </text>
          </g>
        ))}
        {rows.map((row, rowIndex) => {
          const x0 = padding.left + band * rowIndex + (band - groupWidth) / 2;
          return (
            <g key={row.date} onMouseEnter={() => setHover(rowIndex)}>
              {/* Hit target wider than the bars. */}
              <rect x={padding.left + band * rowIndex} y={padding.top} width={band} height={plotHeight} fill={hover === rowIndex ? "#f1f5f9" : "transparent"} />
              {series.map((entry, index) => {
                const value = Number(row[entry.key]) || 0;
                const top = y(value);
                const barHeight = Math.max(0, padding.top + plotHeight - top);
                return (
                  <path
                    key={entry.key}
                    d={roundedTop(x0 + index * (barWidth + 2), top, barWidth, barHeight, Math.min(4, barWidth / 2))}
                    fill={SERIES_COLORS[index]}
                  />
                );
              })}
              {rowIndex % labelEvery === 0 && (
                <text x={padding.left + band * rowIndex + band / 2} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {shortDate(row.date)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} stroke="#94a3b8" strokeWidth={1} />
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute right-2 top-8 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
          <p className="font-semibold text-slate-900">{shortDate(hovered.date)}</p>
          {series.map((entry, index) => (
            <p key={entry.key} className="mt-0.5 flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-sm" style={{ background: SERIES_COLORS[index] }} aria-hidden />
              {entry.label}: <span className="font-semibold text-slate-900">{format(Number(hovered[entry.key]) || 0)}</span>
            </p>
          ))}
        </div>
      )}
    </figure>
  );
}

/** Column path with 4px rounded top corners, anchored flat on the baseline. */
function roundedTop(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0 || width <= 0) return "";
  const r = Math.min(radius, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

/** Horizontal bars for a ranked breakdown (reasons, ride types, zones). */
export function RankedBars({ rows, format = (value: number) => value.toLocaleString("en-IN") }: { rows: Array<{ label: string; value: number; hint?: string }>; format?: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className="text-sm text-slate-500">No data for this range.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex justify-between gap-4 text-sm">
            <span className="truncate text-slate-700">{row.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {format(row.value)}
              {row.hint && <span className="ml-1 font-normal text-slate-500">{row.hint}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: SERIES_COLORS[0] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
