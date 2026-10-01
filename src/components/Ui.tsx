import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, Search, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

/** Loading / error / empty handling every list and detail page shares. */
export function LoadState({
  pending,
  error,
  empty,
  emptyText = "Nothing here yet.",
  children,
}: {
  pending: boolean;
  error: Error | null;
  empty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  if (pending)
    return (
      <p className="flex items-center gap-2 px-5 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="flex items-center gap-2 px-5 py-10 text-sm text-red-600">
        <XCircle className="h-4 w-4" aria-hidden /> {error.message}
      </p>
    );
  if (empty)
    return (
      <p className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-slate-500">
        <Inbox className="h-6 w-6 text-slate-300" aria-hidden />
        {emptyText}
      </p>
    );
  return <>{children}</>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-midnight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    error: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
  }[tone];
  const Icon = tone === "error" ? XCircle : tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg px-4 py-2 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{children}</span>
    </p>
  );
}

/** Debounced search input (300 ms) so typing does not fire a request per key. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed === value) return;
    const timer = setTimeout(() => onChange(trimmed), 300);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);
  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
      <input
        type="search"
        value={draft}
        maxLength={60}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
      />
    </label>
  );
}

export function StatCard({
  label,
  value,
  hint,
  to,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  to?: string;
  tone?: "default" | "good" | "warn" | "bad" | "brand";
}) {
  const color = { default: "text-midnight", good: "text-emerald-600", warn: "text-amber-600", bad: "text-red-600", brand: "text-bhagwa-600" }[tone];
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </>
  );
  const className = "block rounded-2xl border border-slate-200 bg-white p-4";
  return to ? (
    <Link to={to} className={`${className} transition hover:border-bhagwa-500`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" | "brand" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    brand: "bg-bhagwa-100 text-bhagwa-600 ring-bhagwa-500/30",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-transparent ${styles}`}>{children}</span>;
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500 disabled:bg-slate-50";

export function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <span className="mt-1 block">{children}</span>
      {(error || hint) && <span className={`mt-1 block text-xs ${error ? "text-red-600" : "text-slate-500"}`}>{error ?? hint}</span>}
    </label>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  busy,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
}) {
  const styles = {
    primary: "bg-bhagwa-500 text-white hover:bg-bhagwa-600",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-700 hover:bg-slate-100",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${styles}`}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-midnight">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

/**
 * Confirmation for high-impact actions. With `reasonLabel` the admin must
 * type a reason (min 3 chars) that is sent to the API and kept in the audit log.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  reasonLabel,
  reasonRequired = true,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const reasonOk = !reasonLabel || (!reasonRequired && trimmed.length === 0) || trimmed.length >= 3;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reasonOk) onConfirm(reasonLabel && trimmed ? trimmed : undefined);
  }

  return (
    <Modal title={title} onClose={busy ? () => undefined : onCancel}>
      <form onSubmit={handleSubmit}>
        <div className="text-sm text-slate-600">{body}</div>
        {reasonLabel && (
          <div className="mt-4">
            <FormField label={reasonLabel} hint={reasonRequired ? "Required — kept in the audit log" : "Optional — kept in the audit log"}>
              <textarea autoFocus rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
            </FormField>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={!reasonOk} busy={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((label) => (
              <th key={label} className="whitespace-nowrap px-5 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export const cell = "px-5 py-3 align-top";
