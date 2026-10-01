import { useState } from "react";
import type { FormEvent } from "react";
import { AlertOctagon, AlertTriangle, ArrowLeft, CheckCircle2, Info, Loader2, Play } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Pager, Section } from "@/components/DetailUi";
import { Button, ConfirmDialog, FormField, LoadState, Notice, PageHeader, Pill, StatCard, inputClass } from "@/components/Ui";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import {
  usePaymentExceptions,
  useReconciliationRun,
  useReconciliationRuns,
  useResolveException,
  useStartReconciliation,
} from "../api/payments";
import type { ExceptionSeverity, PaymentException, ReconciliationRun } from "../api/payments";

const SEVERITY: Record<ExceptionSeverity, { tone: "red" | "amber" | "blue"; icon: typeof Info; label: string }> = {
  CRITICAL: { tone: "red", icon: AlertOctagon, label: "Critical" },
  WARNING: { tone: "amber", icon: AlertTriangle, label: "Warning" },
  INFO: { tone: "blue", icon: Info, label: "Info" },
};

const KIND_LABELS: Record<PaymentException["kind"], string> = {
  DUPLICATE_UNREFUNDED: "Duplicate payment not refunded",
  WEBHOOK_FLAGGED: "Webhook contradicts our records",
  WEBHOOK_FAILED: "Webhook processing failed",
  REFUND_FAILED: "Refund failed",
  REFUND_STUCK: "Refund stuck",
  REFUND_REVIEW: "Dashboard refund to review",
  EARNING_MISSING: "Driver earning missing",
  PROCESSING_STALE: "Payment unconfirmed",
  LEDGER_PENDING: "Driver deduction pending",
  RUN_EXCEPTION: "Reconciliation mismatch",
};

/** yyyy-mm-dd for a local date input. */
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

function SeverityPill({ severity }: { severity: ExceptionSeverity }) {
  const { tone, icon: Icon, label } = SEVERITY[severity];
  return (
    <Pill tone={tone}>
      <Icon className="mr-1 h-3 w-3" aria-hidden />
      {label}
    </Pill>
  );
}

function RunStatus({ run }: { run: ReconciliationRun }) {
  if (run.status === "RUNNING")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Running
      </span>
    );
  if (run.status === "FAILED") return <Pill tone="red">Failed</Pill>;
  return run.unresolved > 0 ? <Pill tone="amber">{run.unresolved} to resolve</Pill> : <Pill tone="green">Clean</Pill>;
}

function RunForm() {
  const start = useStartReconciliation();
  const today = new Date();
  const [from, setFrom] = useState(localDate(new Date(today.getTime() - 86_400_000)));
  const [to, setTo] = useState(localDate(today));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fromAt = new Date(`${from}T00:00:00`);
    const toDay = new Date(`${to}T00:00:00`);
    const toAt = new Date(Math.min(toDay.getTime() + 86_400_000, Date.now()));
    start.mutate({ from: fromAt.toISOString(), to: toAt.toISOString() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <FormField label="From">
        <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className={inputClass} />
      </FormField>
      <FormField label="To (inclusive)">
        <input type="date" value={to} min={from} max={localDate(today)} onChange={(event) => setTo(event.target.value)} className={inputClass} />
      </FormField>
      <Button type="submit" busy={start.isPending} disabled={!from || !to}>
        <Play className="h-4 w-4" aria-hidden /> Run reconciliation
      </Button>
      {start.error && (
        <div className="w-full">
          <Notice tone="error">{start.error.message}</Notice>
        </div>
      )}
    </form>
  );
}

function RunDetail({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data: run, error, isPending } = useReconciliationRun(runId);
  const resolve = useResolveException();
  const [resolving, setResolving] = useState<string | null>(null);

  return (
    <Section
      title="Run detail"
      action={
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
          Close
        </button>
      }
    >
      <LoadState pending={isPending} error={error}>
        {run && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <RunStatus run={run} />
              <span>
                {formatDateTime(run.from)} → {formatDateTime(run.to)}
              </span>
              <span className="text-slate-400">{run.trigger === "DAILY" ? "Automatic daily run" : "Started by an admin"}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Ride payments at Razorpay" value={run.stats.ridePayments} hint={`${run.stats.foreignPayments} other-app payments ignored`} />
              <StatCard label="Matched" value={run.stats.matched} hint={`${run.stats.recordedChecked} recorded payments checked`} />
              <StatCard
                label="Captured (Razorpay / ours)"
                value={formatMoney(run.stats.gatewayCaptured)}
                hint={`We recorded ${formatMoney(run.stats.recordedCaptured)} paid in this window`}
              />
              <StatCard
                label="Exceptions"
                value={run.stats.exceptions}
                hint={`${run.stats.healed} healed automatically`}
                tone={run.unresolved ? "warn" : "good"}
              />
            </div>
            {run.truncated && <Notice tone="warning">This window had more data than one run checks — run a shorter window for full coverage.</Notice>}
            {run.error && <Notice tone="error">{run.error}</Notice>}
            {run.exceptions && run.exceptions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Severity</th>
                      <th className="py-2 pr-3 font-medium">What</th>
                      <th className="py-2 pr-3 font-medium">Ours</th>
                      <th className="py-2 pr-3 font-medium">Razorpay</th>
                      <th className="py-2 pr-3 font-medium">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {run.exceptions.map((exception) => (
                      <tr key={exception.id} className="align-top">
                        <td className="py-3 pr-3">
                          <SeverityPill severity={exception.severity} />
                        </td>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-slate-900">{titleCase(exception.type)}</p>
                          <p className="text-xs text-slate-500">{exception.detail}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">
                            {exception.paymentId ? (
                              <Link to={`/payments/${exception.paymentId}`} className="text-bhagwa-600 hover:underline">
                                {exception.rideCode ?? exception.paymentId.slice(-8)}
                              </Link>
                            ) : null}{" "}
                            {exception.razorpayPaymentId}
                          </p>
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-600">{exception.expected ?? "—"}</td>
                        <td className="py-3 pr-3 text-xs text-slate-600">{exception.actual ?? "—"}</td>
                        <td className="py-3 pr-3 text-xs">
                          {exception.healed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Healed
                            </span>
                          ) : exception.resolvedAt ? (
                            <span className="text-slate-600">
                              Resolved {formatDateTime(exception.resolvedAt)}
                              {exception.resolutionNote && <span className="block text-slate-400">{exception.resolutionNote}</span>}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                resolve.reset();
                                setResolving(exception.id);
                              }}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Mark resolved
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              run.status === "COMPLETED" && (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Razorpay and Tirvona agree for this window.
                </p>
              )
            )}
          </div>
        )}
      </LoadState>
      {resolving && run && (
        <ConfirmDialog
          title="Mark exception resolved"
          body="Record what was done about this mismatch. It stays in the run for the audit trail."
          confirmLabel="Mark resolved"
          reasonLabel="Resolution"
          busy={resolve.isPending}
          error={resolve.error?.message ?? null}
          onCancel={() => setResolving(null)}
          onConfirm={(note) =>
            resolve.mutate({ runId: run.id, exceptionId: resolving, note: note ?? "" }, { onSuccess: () => setResolving(null) })
          }
        />
      )}
    </Section>
  );
}

/**
 * Razorpay ↔ Tirvona reconciliation: what needs a human now (live), and
 * time-window runs that compare every Razorpay payment with our records.
 */
export function ReconciliationPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const selectedRun = params.get("run") ?? undefined;
  const exceptions = usePaymentExceptions();
  const runs = useReconciliationRuns(page);

  const select = (runId?: string) => {
    const next: Record<string, string> = {};
    if (page > 1) next.page = String(page);
    if (runId) next.run = runId;
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link to="/payments" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-bhagwa-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Payments
      </Link>
      <PageHeader
        title="Reconciliation"
        subtitle="Razorpay is compared with Tirvona's records every minute (open payments, refunds) and every night (the previous day, end to end)"
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Critical" value={exceptions.data?.counts.CRITICAL ?? "—"} tone={exceptions.data?.counts.CRITICAL ? "bad" : "good"} />
        <StatCard label="Warnings" value={exceptions.data?.counts.WARNING ?? "—"} tone={exceptions.data?.counts.WARNING ? "warn" : "default"} />
        <StatCard label="To review" value={exceptions.data?.counts.INFO ?? "—"} />
        <StatCard
          label="Last run"
          value={exceptions.data?.lastRun ? formatDateTime(exceptions.data.lastRun.startedAt) : "Never"}
          hint={exceptions.data?.lastRun ? `${exceptions.data.lastRun.stats.ridePayments} Ride payments checked` : undefined}
        />
      </div>

      <Section title="Needs attention">
        <LoadState
          pending={exceptions.isPending}
          error={exceptions.error}
          empty={exceptions.data?.items.length === 0}
          emptyText="Nothing needs attention — payments, refunds and webhooks agree with Razorpay."
        >
          <ul className="divide-y divide-slate-100">
            {exceptions.data?.items.map((item, index) => (
              <li key={`${item.kind}-${item.reference ?? item.paymentId}-${index}`} className="flex flex-wrap items-start gap-3 py-3">
                <SeverityPill severity={item.severity} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {KIND_LABELS[item.kind]}
                    {item.amount !== undefined && <span className="ml-2 tabular-nums text-slate-600">{formatMoney(item.amount)}</span>}
                  </p>
                  <p className="text-sm text-slate-600">{item.detail}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDateTime(item.at)}
                    {item.reference && <span className="ml-2 font-mono">{item.reference}</span>}
                  </p>
                </div>
                {item.paymentId && (
                  <Link
                    to={`/payments/${item.paymentId}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {item.rideCode ?? "Open payment"}
                  </Link>
                )}
                {item.runId && (
                  <button
                    type="button"
                    onClick={() => select(item.runId)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open run
                  </button>
                )}
              </li>
            ))}
          </ul>
        </LoadState>
      </Section>

      <Section title="Reconcile a period">
        <p className="mb-4 text-sm text-slate-500">
          Every Razorpay payment created in the period is compared with Tirvona's records, and every payment Tirvona recorded as
          paid is checked at Razorpay. Safe fixes (a payment Razorpay captured that we missed, refund totals) are applied
          automatically; the rest are listed for you. Payments of other apps on the same Razorpay account are ignored.
        </p>
        <RunForm />
      </Section>

      {selectedRun && <RunDetail runId={selectedRun} onClose={() => select(undefined)} />}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-midnight">Runs</h2>
        <LoadState pending={runs.isPending} error={runs.error} empty={runs.data?.items.length === 0} emptyText="No runs yet.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Started</th>
                  <th className="px-5 py-3 font-medium">Period</th>
                  <th className="px-5 py-3 font-medium">Trigger</th>
                  <th className="px-5 py-3 text-right font-medium">Ride payments</th>
                  <th className="px-5 py-3 text-right font-medium">Exceptions</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.data?.items.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => select(run.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${run.id === selectedRun ? "bg-bhagwa-100/40" : ""}`}
                  >
                    <td className="px-5 py-3 text-xs text-slate-600">{formatDateTime(run.startedAt)}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {formatDateTime(run.from)} → {formatDateTime(run.to)}
                    </td>
                    <td className="px-5 py-3">{run.trigger === "DAILY" ? "Daily" : "Admin"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{run.stats.ridePayments}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {run.stats.exceptions}
                      {run.stats.healed > 0 && <span className="block text-xs text-emerald-700">{run.stats.healed} healed</span>}
                    </td>
                    <td className="px-5 py-3">
                      <RunStatus run={run} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadState>
        {runs.data && (
          <Pager
            page={runs.data.page}
            limit={runs.data.limit}
            count={runs.data.items.length}
            total={runs.data.total}
            hasMore={runs.data.hasMore}
            fetching={runs.isFetching}
            onPage={(next) => setParams({ page: String(next) })}
          />
        )}
      </section>
    </div>
  );
}
