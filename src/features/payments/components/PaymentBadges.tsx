import { titleCase } from "@/lib/format";
import type { PaymentStatus, RidePaymentStatus } from "../api/payments";
import type { EarningStatus } from "@/features/earnings/api/earnings";

const badge = "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

const paymentStyles: Record<PaymentStatus, string> = {
  CREATED: "bg-sky-100 text-sky-800",
  AUTHORIZED: "bg-amber-100 text-amber-800",
  CAPTURED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-slate-200 text-slate-700",
  PARTIALLY_REFUNDED: "bg-slate-200 text-slate-700",
};

const PAYMENT_LABELS: Partial<Record<PaymentStatus, string>> = { CREATED: "Awaiting payment", CAPTURED: "Paid" };

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={`${badge} ${paymentStyles[status]}`}>{PAYMENT_LABELS[status] ?? titleCase(status)}</span>;
}

const rideStyles: Record<RidePaymentStatus, string> = {
  NOT_REQUIRED: "bg-slate-100 text-slate-600",
  PENDING: "bg-amber-100 text-amber-800",
  ORDER_CREATED: "bg-sky-100 text-sky-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SUCCESS: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-200 text-slate-700",
  REFUNDED: "bg-slate-200 text-slate-700",
  PARTIALLY_REFUNDED: "bg-slate-200 text-slate-700",
};

const RIDE_LABELS: Partial<Record<RidePaymentStatus, string>> = {
  NOT_REQUIRED: "Nothing due",
  PENDING: "Unpaid",
  ORDER_CREATED: "Checkout opened",
  SUCCESS: "Paid",
};

export function RidePaymentBadge({ status }: { status: RidePaymentStatus }) {
  return <span className={`${badge} ${rideStyles[status]}`}>{RIDE_LABELS[status] ?? titleCase(status)}</span>;
}

const earningStyles: Record<EarningStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  AVAILABLE: "bg-sky-100 text-sky-800",
  PAID: "bg-emerald-100 text-emerald-800",
  COLLECTED: "bg-orange-100 text-orange-800",
};

export function EarningStatusBadge({ status }: { status: EarningStatus }) {
  return (
    <span className={`${badge} ${earningStyles[status]}`}>{status === "COLLECTED" ? "Cash collected" : titleCase(status)}</span>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-midnight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
