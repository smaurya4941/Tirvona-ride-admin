import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Info, Undo2 } from "lucide-react";
import { Button, FormField, Modal, Notice, inputClass } from "@/components/Ui";
import { formatMoney, titleCase } from "@/lib/format";
import {
  DEFAULT_DRIVER_IMPACT,
  REFUND_REASONS,
  REFUND_REASON_LABELS,
  useCreateRefund,
  useReviewRefund,
} from "../api/payments";
import type { PaymentDetail, Refund, RefundDriverImpact, RefundReason, RefundStatus } from "../api/payments";

const badge = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

const REFUND_STYLES: Record<RefundStatus, string> = {
  REQUESTED: "bg-sky-100 text-sky-800",
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-700",
};
const REFUND_LABELS: Record<RefundStatus, string> = {
  REQUESTED: "Confirming",
  PENDING: "Processing",
  PROCESSED: "Refunded",
  FAILED: "Failed",
};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return <span className={`${badge} ${REFUND_STYLES[status]}`}>{REFUND_LABELS[status]}</span>;
}

/** Two-option segmented control. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              active ? "border-bhagwa-500 bg-bhagwa-100/60 ring-1 ring-bhagwa-500" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="block text-sm font-semibold text-midnight">{option.label}</span>
            <span className="block text-xs text-slate-500">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** UUID v4 — randomUUID needs a secure context, getRandomValues does not. */
function newKey(): string {
  if (typeof crypto.randomUUID === "function" && window.isSecureContext) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Refund (part of) the ride payment. The server re-validates everything —
 * the numbers here are a preview. One idempotency key per dialog: a double
 * click or a retry after a timeout can never refund twice.
 */
export function RefundDialog({ payment, onClose, onDone }: { payment: PaymentDetail; onClose: () => void; onDone: (refund: Refund) => void }) {
  const refund = useCreateRefund();
  const [idempotencyKey] = useState(newKey);
  const [mode, setMode] = useState<"FULL" | "PARTIAL">("FULL");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState<RefundReason>("FARE_ADJUSTMENT");
  const [impact, setImpact] = useState<RefundDriverImpact>(DEFAULT_DRIVER_IMPACT.FARE_ADJUSTMENT);
  const [impactTouched, setImpactTouched] = useState(false);
  const [note, setNote] = useState("");

  const refundable = payment.refundable;
  const amount = mode === "FULL" ? refundable : Number(amountText);
  const amountError =
    mode === "FULL"
      ? null
      : !amountText.trim()
        ? "Enter an amount"
        : !/^\d+(\.\d{1,2})?$/.test(amountText.trim())
          ? "Up to 2 decimals"
          : amount < 1
            ? "At least ₹1"
            : amount > refundable
              ? `At most ${formatMoney(refundable)}`
              : null;
  const noteOk = note.trim().length >= 3;

  // Preview of the driver's share at the earning line's own snapshot.
  const driverShare = useMemo(() => {
    if (impact === "NONE" || !payment.earning || amountError || amount <= 0) return 0;
    return Math.round(payment.earning.netEarning * (amount / payment.amount) * 100) / 100;
  }, [impact, payment, amount, amountError]);

  function chooseReason(next: RefundReason) {
    setReason(next);
    if (!impactTouched) setImpact(DEFAULT_DRIVER_IMPACT[next]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (amountError || !noteOk) return;
    refund.mutate(
      {
        paymentId: payment.id,
        amount: mode === "FULL" ? undefined : Number(amountText),
        reason,
        note: note.trim(),
        driverImpact: impact,
        idempotencyKey,
      },
      { onSuccess: onDone },
    );
  }

  const method = payment.method ? payment.method.toUpperCase() : "the original method";

  return (
    <Modal title="Refund customer" onClose={refund.isPending ? () => undefined : onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-sand p-3 text-center">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Paid</p>
            <p className="font-semibold tabular-nums text-midnight">{formatMoney(payment.amount)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Refunded</p>
            <p className="font-semibold tabular-nums text-midnight">
              {formatMoney((payment.refund?.amount ?? 0) + (payment.refund?.pending ?? 0))}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Refundable</p>
            <p className="font-semibold tabular-nums text-emerald-700">{formatMoney(refundable)}</p>
          </div>
        </div>

        <FormField label="How much">
          <Segmented
            label="Refund amount"
            value={mode}
            onChange={setMode}
            options={[
              { value: "FULL", label: "Full refund", hint: `${formatMoney(refundable)} — everything left` },
              { value: "PARTIAL", label: "Partial refund", hint: "Choose an amount" },
            ]}
          />
        </FormField>
        {mode === "PARTIAL" && (
          <FormField label="Amount (₹)" error={amountText ? (amountError ?? undefined) : undefined}>
            <input
              autoFocus
              inputMode="decimal"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              placeholder={`1 – ${refundable}`}
              className={inputClass}
            />
          </FormField>
        )}

        <FormField label="Reason">
          <select value={reason} onChange={(event) => chooseReason(event.target.value as RefundReason)} className={inputClass}>
            {REFUND_REASONS.filter((option) => option !== "DUPLICATE_PAYMENT").map((option) => (
              <option key={option} value={option}>
                {REFUND_REASON_LABELS[option]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Who bears it">
          <Segmented
            label="Driver impact"
            value={impact}
            onChange={(next) => {
              setImpact(next);
              setImpactTouched(true);
            }}
            options={[
              { value: "PROPORTIONAL", label: "Driver shares it", hint: "Their share is deducted from the next payout" },
              { value: "NONE", label: "Tirvona bears it", hint: "Driver earnings unchanged" },
            ]}
          />
        </FormField>

        <FormField label="Note" hint="Required — kept in the payment's audit trail and the admin audit log">
          <textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
        </FormField>

        {!amountError && amount > 0 && (
          <div className="flex gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              The customer gets <strong>{formatMoney(amount)}</strong> back to {method}; banks usually show it in 5–7 working days.
              {driverShare > 0 ? (
                <>
                  {" "}
                  About <strong>{formatMoney(driverShare)}</strong> will be deducted from {payment.driver?.name ?? "the driver"}'s next
                  payout.
                </>
              ) : (
                " The driver's earnings do not change."
              )}
            </p>
          </div>
        )}

        {refund.error && <Notice tone="error">{refund.error.message}</Notice>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={refund.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={Boolean(amountError) || !noteOk} busy={refund.isPending}>
            <Undo2 className="h-4 w-4" aria-hidden /> Refund {amountError ? "" : formatMoney(amount)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Return a duplicate capture whole (never revenue, never the driver's). */
export function DuplicateRefundDialog({
  payment,
  duplicate,
  onClose,
  onDone,
}: {
  payment: PaymentDetail;
  duplicate: PaymentDetail["duplicateCaptures"][number];
  onClose: () => void;
  onDone: (refund: Refund) => void;
}) {
  const refund = useCreateRefund();
  const [idempotencyKey] = useState(newKey);
  const [note, setNote] = useState("Customer paid twice for the same ride");
  return (
    <Modal title="Refund duplicate payment" onClose={refund.isPending ? () => undefined : onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (note.trim().length < 3) return;
          refund.mutate(
            {
              paymentId: payment.id,
              target: "DUPLICATE_CAPTURE",
              razorpayPaymentId: duplicate.razorpayPaymentId,
              reason: "DUPLICATE_PAYMENT",
              note: note.trim(),
              idempotencyKey,
            },
            { onSuccess: onDone },
          );
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-600">
          <span className="font-mono">{duplicate.razorpayPaymentId}</span> is a second payment for ride{" "}
          <span className="font-mono">{payment.rideCode}</span>. The full {formatMoney(duplicate.amount)} goes back to the customer. It
          was never counted as revenue and the driver is not affected.
        </p>
        <FormField label="Note">
          <textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
        </FormField>
        {refund.error && <Notice tone="error">{refund.error.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={refund.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" busy={refund.isPending} disabled={note.trim().length < 3}>
            <Undo2 className="h-4 w-4" aria-hidden /> Refund {formatMoney(duplicate.amount)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** A refund made in the Razorpay dashboard: decide whether the driver shares it. */
export function ReviewRefundDialog({ refund, onClose, onDone }: { refund: Refund; onClose: () => void; onDone: (refund: Refund) => void }) {
  const review = useReviewRefund();
  const [impact, setImpact] = useState<RefundDriverImpact>("NONE");
  const [note, setNote] = useState("");
  return (
    <Modal title="Review dashboard refund" onClose={review.isPending ? () => undefined : onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (note.trim().length < 3) return;
          review.mutate({ refundId: refund.id, driverImpact: impact, note: note.trim() }, { onSuccess: onDone });
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-600">
          Someone refunded {formatMoney(refund.amount)} for ride <span className="font-mono">{refund.rideCode}</span> directly in the
          Razorpay dashboard ({refund.razorpayRefundId}). Tirvona recorded it; decide who bears it.
        </p>
        <Segmented
          label="Driver impact"
          value={impact}
          onChange={setImpact}
          options={[
            { value: "PROPORTIONAL", label: "Driver shares it", hint: "Deduct their share from the next payout" },
            { value: "NONE", label: "Tirvona bears it", hint: "Driver earnings unchanged" },
          ]}
        />
        <FormField label="Note" hint="Why — kept in the audit trail">
          <textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
        </FormField>
        {review.error && <Notice tone="error">{review.error.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={review.isPending}>
            Cancel
          </Button>
          <Button type="submit" busy={review.isPending} disabled={note.trim().length < 3}>
            Save decision
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export const refundReasonLabel = (reason: RefundReason) => REFUND_REASON_LABELS[reason] ?? titleCase(reason);
