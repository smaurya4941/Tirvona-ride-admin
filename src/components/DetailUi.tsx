import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export function Section({ title, children, className = "", action }: { title: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-midnight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm text-slate-900 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</dd>
    </div>
  );
}

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  render,
}: {
  options: readonly (T | undefined)[];
  value?: T;
  onChange: (value?: T) => void;
  label: string;
  render: (value?: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option ?? "ALL"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
              active ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {render(option)}
          </button>
        );
      })}
    </div>
  );
}

export function Pager({
  page,
  limit,
  count,
  total,
  hasMore,
  fetching,
  onPage,
}: {
  page: number;
  limit: number;
  count: number;
  total: number;
  hasMore: boolean;
  fetching?: boolean;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-[13px] text-slate-600">
      <span className="flex items-center gap-2">
        {(page - 1) * limit + 1}–{(page - 1) * limit + count} of {total}
        {fetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="Refreshing" />}
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Previous
        </button>
        <button
          type="button"
          disabled={!hasMore}
          onClick={() => onPage(page + 1)}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40 transition-colors"
        >
          Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </span>
    </footer>
  );
}

/** "4 min ago" — how long an alert has been waiting. */
export function timeAgo(value?: string | null): string {
  if (!value) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
