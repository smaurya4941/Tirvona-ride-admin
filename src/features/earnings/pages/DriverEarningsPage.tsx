import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Banknote, CheckCircle2, ChevronLeft, ChevronRight, Loader2, MinusCircle, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { EarningStatusBadge, StatCard } from "@/features/payments/components/PaymentBadges";
import { ConfirmDialog, Pill } from "@/components/Ui";
import { useCreatePayout, useDriverEarnings, usePayoutPreview, useWaiveAdjustment } from "../api/earnings";
import type { Adjustment, AdjustmentStatus, Earning, EarningStatus } from "../api/earnings";

const REASON_LABELS: Record<string, string> = {
  ADMIN_REFUND: "Admin refund",
  RIDE_CANCELLED: "Ride cancelled",
  FARE_ADJUSTMENT: "Fare adjustment",
  CUSTOMER_SUPPORT: "Customer support",
  DUPLICATE_PAYMENT: "Duplicate payment",
  SYSTEM_ERROR: "System error",
  EXTERNAL: "Dashboard refund",
};

const ADJUSTMENT_TONE: Record<AdjustmentStatus, "amber" | "green" | "slate"> = {
  OUTSTANDING: "amber",
  SETTLED: "green",
  WAIVED: "slate",
};

const STATUS_FILTERS: Array<EarningStatus | undefined> = [undefined, "AVAILABLE", "PENDING", "PAID", "COLLECTED"];
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9 ._/#-]*$/;

interface PayoutDialogProps {
  driverId: string;
  driverName: string;
  earnings: Earning[];
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (payoutReference: string, note?: string) => void;
}

function PayoutDialog({ driverId, driverName, earnings, isSubmitting, error, onCancel, onConfirm }: PayoutDialogProps) {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const total = earnings.reduce((sum, earning) => sum + Math.round(earning.netEarning * 100), 0) / 100;
  // The server decides which refund deductions this payout recovers.
  const preview = usePayoutPreview(
    driverId,
    earnings.map((earning) => earning.id),
    true,
  );
  const deduction = preview.data?.deductionAmount ?? 0;
  const transfer = preview.data?.amount ?? total;
  const trimmed = reference.trim();
  const referenceError =
    trimmed.length < 3 ? "At least 3 characters" : !REFERENCE.test(trimmed) ? "Letters, digits, spaces and . _ / # -" : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!referenceError) onConfirm(trimmed, note.trim() || undefined);
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-midnight">Mark payout as paid</h2>
        <p className="mt-1 text-sm text-slate-500">
          Record a transfer you have already made to {driverName}. Tirvona does not move the money itself.
        </p>
        <div className="mt-4 rounded-xl bg-sand p-4">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>{earnings.length} earnings</dt>
              <dd className="tabular-nums">{formatMoney(total)}</dd>
            </div>
            {preview.isPending ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking refund deductions…
              </div>
            ) : (
              deduction > 0 && (
                <div className="flex justify-between text-amber-700">
                  <dt>Refund deductions ({preview.data?.adjustmentCount})</dt>
                  <dd className="tabular-nums">− {formatMoney(deduction)}</dd>
                </div>
              )
            )}
            <div className="flex justify-between border-t border-slate-300 pt-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Transfer to driver</dt>
              <dd className="text-2xl font-bold tabular-nums text-midnight">{formatMoney(transfer)}</dd>
            </div>
          </dl>
          {preview.data && preview.data.outstandingDeductions > deduction && (
            <p className="mt-2 text-xs text-slate-500">
              {formatMoney(preview.data.outstandingDeductions - deduction)} of deductions will carry over to a later payout.
            </p>
          )}
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-800">Payout reference</span>
          <input
            autoFocus
            value={reference}
            maxLength={80}
            onChange={(event) => setReference(event.target.value)}
            placeholder="e.g. BANK-SEP-24001 or UPI ref"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
          />
          {reference && referenceError && <span className="mt-1 block text-xs text-red-600">{referenceError}</span>}
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-slate-800">Note (optional)</span>
          <input
            value={note}
            maxLength={240}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. September weekly settlement"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || Boolean(referenceError) || preview.isPending}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Mark paid
          </button>
        </div>
      </form>
    </div>
  );
}

export function DriverEarningsPage() {
  const { driverId = "" } = useParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EarningStatus | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const { data, error, isPending, isFetching } = useDriverEarnings(driverId, page, status);
  const payout = useCreatePayout();
  const waive = useWaiveAdjustment();
  const [waiving, setWaiving] = useState<Adjustment | null>(null);

  const available = useMemo(
    () => (data?.ledger.items ?? []).filter((earning) => earning.status === "AVAILABLE"),
    [data],
  );
  const chosen = available.filter((earning) => selected.has(earning.id));
  const allChosen = available.length > 0 && chosen.length === available.length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  if (isPending)
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading driver earnings…
      </p>
    );
  if (error || !data)
    return (
      <p className="flex items-center gap-2 text-sm text-red-600">
        <XCircle className="h-4 w-4" aria-hidden /> {error?.message ?? "Not found"}
      </p>
    );

  const { driver, summary, ledger, payouts, adjustments } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link to="/earnings" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-bhagwa-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Driver earnings
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-midnight">{driver.name}</h1>
          <p className="font-mono text-sm text-slate-500">
            {driver.driverCode} · {driver.phone}
          </p>
        </div>
        <button
          type="button"
          disabled={chosen.length === 0}
          onClick={() => {
            payout.reset();
            setDialogOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          <Banknote className="h-4 w-4" aria-hidden />
          Mark {chosen.length || ""} as paid
        </button>
      </header>

      {done && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {done}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total gross" value={formatMoney(summary.gross)} hint={`${summary.rides} paid rides`} />
        <StatCard label="Total commission" value={formatMoney(summary.commission)} />
        <StatCard label="Total earnings" value={formatMoney(summary.net)} />
        <StatCard label="Pending" value={formatMoney(summary.pending)} />
        <StatCard label="Available" value={formatMoney(summary.available)} />
        <StatCard label="Paid" value={formatMoney(summary.paid)} />
        {summary.deductions > 0 && (
          <StatCard
            label="Refund deductions"
            value={formatMoney(summary.deductions)}
            hint="Recovered from the next payout"
          />
        )}
        {(summary.collected > 0 || summary.commissionDue > 0) && (
          <StatCard
            label="Cash commission due"
            value={formatMoney(summary.commissionDue)}
            hint={`Driver kept ${formatMoney(summary.collected)} of cash fares`}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter ?? "ALL"}
            type="button"
            role="tab"
            aria-selected={filter === status}
            onClick={() => {
              setStatus(filter);
              setPage(1);
              setSelected(new Set());
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === status ? "bg-bhagwa-500 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {filter ? titleCase(filter) : "All"}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl shadow-sm border border-slate-200 bg-white">
        {ledger.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No earnings here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all available earnings on this page"
                      checked={allChosen}
                      disabled={available.length === 0}
                      onChange={() => setSelected(allChosen ? new Set() : new Set(available.map((earning) => earning.id)))}
                    />
                  </th>
                  <th className="px-5 py-3 font-medium">Ride</th>
                  <th className="px-5 py-3 text-right font-medium">Gross fare</th>
                  <th className="px-5 py-3 text-right font-medium">Commission</th>
                  <th className="px-5 py-3 text-right font-medium">Net</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.items.map((earning) => (
                  <tr key={earning.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      {earning.status === "AVAILABLE" && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${earning.rideCode}`}
                          checked={selected.has(earning.id)}
                          onChange={() => toggle(earning.id)}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Link to={`/rides/${earning.rideId}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
                        {earning.rideCode}
                      </Link>
                      <p className="max-w-xs truncate text-xs text-slate-500" title={earning.destinationAddress}>
                        {titleCase(earning.rideType)} · → {earning.destinationAddress}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right">{formatMoney(earning.grossFare)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {formatMoney(earning.commissionAmount)}
                      <p className="text-xs text-slate-400">{earning.commissionRate}%</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">{formatMoney(earning.netEarning)}</td>
                    <td className="px-5 py-3">
                      <EarningStatusBadge status={earning.status} />
                      <p className="mt-1 text-xs text-slate-500">
                        {earning.paymentMode === "CASH" ? "Paid in cash" : `Online · ${(earning.paymentMethod ?? "—").toUpperCase()}`}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">{formatDateTime(earning.rideCompletedAt)}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {earning.payoutReference ? (
                        <>
                          <span className="font-mono">{earning.payoutReference}</span>
                          <p>{formatDateTime(earning.paidAt)}</p>
                        </>
                      ) : earning.status === "PENDING" ? (
                        `Available ${formatDateTime(earning.availableAt)}`
                      ) : earning.status === "COLLECTED" ? (
                        `Kept by driver · ${formatMoney(earning.commissionAmount)} commission due`
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ledger.total > ledger.limit && (
          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              {(ledger.page - 1) * ledger.limit + 1}–{(ledger.page - 1) * ledger.limit + ledger.items.length} of {ledger.total}
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="Refreshing" />}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
              </button>
              <button
                type="button"
                disabled={!ledger.hasMore}
                onClick={() => setPage(page + 1)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </span>
          </footer>
        )}
      </section>

      {adjustments.length > 0 && (
        <section className="overflow-hidden rounded-xl shadow-sm border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-midnight">
              <MinusCircle className="h-4 w-4 text-amber-600" aria-hidden /> Refund deductions
            </h2>
            <p className="text-xs text-slate-500">The driver's share of customer refunds, at each ride's own commission rate</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Ride</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 text-right font-medium">Customer refund</th>
                  <th className="px-5 py-3 text-right font-medium">Commission returned</th>
                  <th className="px-5 py-3 text-right font-medium">Deducted</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.map((adjustment) => (
                  <tr key={adjustment.id}>
                    <td className="px-5 py-3">
                      <Link to={`/payments/${adjustment.paymentId}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
                        {adjustment.rideCode}
                      </Link>
                      <p className="text-xs text-slate-500">{formatDateTime(adjustment.createdAt)}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{REASON_LABELS[adjustment.reason] ?? titleCase(adjustment.reason)}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(adjustment.refundAmount)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {formatMoney(adjustment.commissionReversal)}
                      <p className="text-xs text-slate-400">{adjustment.commissionRate}%</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-amber-700">− {formatMoney(adjustment.amount)}</td>
                    <td className="px-5 py-3">
                      <Pill tone={ADJUSTMENT_TONE[adjustment.status]}>
                        {adjustment.status === "SETTLED" ? "Recovered" : titleCase(adjustment.status)}
                      </Pill>
                      {adjustment.waiverNote && <p className="mt-1 text-xs text-slate-500">{adjustment.waiverNote}</p>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {adjustment.status === "OUTSTANDING" && (
                        <button
                          type="button"
                          onClick={() => {
                            waive.reset();
                            setWaiving(adjustment);
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Waive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl shadow-sm border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-midnight">Payout history</h2>
        {payouts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No payouts recorded yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Paid</th>
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 text-right font-medium">Earnings</th>
                <th className="px-5 py-3 text-right font-medium">Deductions</th>
                <th className="px-5 py-3 text-right font-medium">Transferred</th>
                <th className="px-5 py-3 font-medium">By</th>
                <th className="px-5 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-5 py-3 text-xs text-slate-600">{formatDateTime(entry.paidAt)}</td>
                  <td className="px-5 py-3 font-mono text-xs">{entry.payoutReference}</td>
                  <td className="px-5 py-3 text-right">
                    {formatMoney(entry.grossAmount)}
                    <p className="text-xs text-slate-400">{entry.earningCount} rides</p>
                  </td>
                  <td className="px-5 py-3 text-right text-amber-700">
                    {entry.deductionAmount > 0 ? `− ${formatMoney(entry.deductionAmount)}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">{formatMoney(entry.amount)}</td>
                  <td className="px-5 py-3">{entry.paidBy.name}</td>
                  <td className="px-5 py-3 text-slate-600">{entry.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {dialogOpen && (
        <PayoutDialog
          driverId={driver.driverId}
          driverName={driver.name}
          earnings={chosen}
          isSubmitting={payout.isPending}
          error={payout.error?.message ?? null}
          onCancel={() => setDialogOpen(false)}
          onConfirm={(payoutReference, note) =>
            payout.mutate(
              { driverId: driver.driverId, earningIds: chosen.map((earning) => earning.id), payoutReference, note },
              {
                onSuccess: (recorded) => {
                  setDialogOpen(false);
                  setSelected(new Set());
                  setDone(
                    `Recorded payout ${recorded.payoutReference}: ${formatMoney(recorded.amount)} for ${recorded.earningCount} earnings` +
                      (recorded.deductionAmount > 0 ? ` (after ${formatMoney(recorded.deductionAmount)} refund deductions).` : "."),
                  );
                },
              },
            )
          }
        />
      )}

      {waiving && (
        <ConfirmDialog
          title="Waive this deduction?"
          body={
            <>
              {formatMoney(waiving.amount)} will no longer be deducted from {driver.name}'s payouts for ride{" "}
              <span className="font-mono">{waiving.rideCode}</span>. Tirvona bears the refund instead.
            </>
          }
          confirmLabel="Waive deduction"
          reasonLabel="Why is Tirvona bearing this refund?"
          busy={waive.isPending}
          error={waive.error?.message ?? null}
          onCancel={() => setWaiving(null)}
          onConfirm={(note) =>
            waive.mutate(
              { id: waiving.id, note: note ?? "" },
              {
                onSuccess: () => {
                  setWaiving(null);
                  setDone(`Waived the ${formatMoney(waiving.amount)} deduction on ride ${waiving.rideCode}.`);
                },
              },
            )
          }
        />
      )}
    </div>
  );
}
