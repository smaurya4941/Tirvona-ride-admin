import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, RefreshCw, Route, Undo2, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Pill } from "@/components/Ui";
import { formatDateTime, formatKm, formatMinutes, formatMoney, titleCase } from "@/lib/format";
import { usePayment, useReconcilePayment } from "../api/payments";
import type { PaymentDetail, Refund } from "../api/payments";
import { EarningStatusBadge, PaymentStatusBadge, RidePaymentBadge } from "../components/PaymentBadges";
import {
  DuplicateRefundDialog,
  RefundDialog,
  RefundStatusBadge,
  ReviewRefundDialog,
  refundReasonLabel,
} from "../components/RefundDialogs";
import type { EarningStatus } from "@/features/earnings/api/earnings";

function Section({ title, children, className = "", action }: { title: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-xl shadow-sm border border-slate-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-midnight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 break-all text-sm text-slate-900 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</dd>
    </div>
  );
}

function Line({ label, value, strong, muted }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 text-sm ${muted ? "text-slate-500" : "text-slate-800"}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-bold text-midnight" : ""}`}>{value}</span>
    </div>
  );
}

function methodLabel(method?: string, details?: { bank?: string; wallet?: string; cardNetwork?: string; cardLast4?: string }) {
  if (!method) return undefined;
  const extra = [details?.bank, details?.wallet, details?.cardNetwork, details?.cardLast4 && `•••• ${details.cardLast4}`]
    .filter(Boolean)
    .join(" · ");
  return extra ? `${method.toUpperCase()} (${extra})` : method.toUpperCase();
}

const SOURCE_LABEL = { ACTUAL: "measured", BOOKED: "booked route" } as const;

function FinalBill({ payment }: { payment: PaymentDetail }) {
  const ride = payment.ride;
  const final = ride?.final;
  if (!ride) return <p className="text-sm text-slate-500">Ride not found.</p>;
  if (!final)
    return (
      <dl className="space-y-1">
        <Line label="Final fare" value={formatMoney(ride.finalFare)} strong />
        <Line label="Estimate" value={formatMoney(ride.estimatedFare)} muted />
        <p className="pt-2 text-xs text-slate-500">Completed before the final-fare snapshot existed.</p>
      </dl>
    );
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Distance</p>
          <p className="font-semibold text-midnight">{formatKm(final.distanceMeters)}</p>
          <Pill tone={final.distanceSource === "ACTUAL" ? "green" : "slate"}>{SOURCE_LABEL[final.distanceSource]}</Pill>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Time</p>
          <p className="font-semibold text-midnight">{formatMinutes(final.durationSeconds)}</p>
          <Pill tone={final.durationSource === "ACTUAL" ? "green" : "slate"}>{SOURCE_LABEL[final.durationSource]}</Pill>
        </div>
      </div>
      <dl>
        <Line label="Base fare" value={formatMoney(final.baseFare)} />
        <Line label="Distance" value={formatMoney(final.distanceCharge)} />
        <Line label="Time" value={formatMoney(final.timeCharge)} />
        {final.minimumFareApplied && <Line label="Minimum fare applied" value="✓" muted />}
        {final.capApplied && (
          <Line label={<span className="text-amber-700">Capped at 1.5 × estimate</span>} value={formatMoney(final.total)} muted />
        )}
        {final.discount > 0 && <Line label="Promo discount" value={`− ${formatMoney(final.discount)}`} />}
        <div className="my-1 border-t border-slate-200" />
        <Line label="Customer pays" value={formatMoney(final.payable)} strong />
        <Line label={`Estimate · tariff v${final.pricingVersion}`} value={formatMoney(ride.estimatedFare)} muted />
      </dl>
    </div>
  );
}

function RefundRow({ refund, onReview }: { refund: Refund; onReview: (refund: Refund) => void }) {
  return (
    <tr className="align-top">
      <td className="py-3 pr-3 text-xs text-slate-600">
        {formatDateTime(refund.createdAt)}
        <p className="text-slate-400">{refund.requestedBy?.name ?? titleCase(refund.source)}</p>
      </td>
      <td className="py-3 pr-3">
        <p className="font-semibold tabular-nums">{formatMoney(refund.amount)}</p>
        {refund.target === "DUPLICATE_CAPTURE" && <Pill tone="amber">Duplicate</Pill>}
      </td>
      <td className="py-3 pr-3">
        <p className="text-slate-800">{refundReasonLabel(refund.reason)}</p>
        {refund.note && <p className="max-w-xs text-xs text-slate-500">{refund.note}</p>}
      </td>
      <td className="py-3 pr-3 text-xs">
        {refund.needsReview ? (
          <button
            type="button"
            onClick={() => onReview(refund)}
            className="rounded-lg bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-200"
          >
            Review
          </button>
        ) : refund.driverImpact === "NONE" ? (
          <span className="text-slate-500">Tirvona</span>
        ) : refund.adjustment ? (
          <span className="text-amber-700">Driver −{formatMoney(refund.adjustment.amount)}</span>
        ) : (
          <span className="text-slate-500">Driver share{refund.status === "PROCESSED" ? " (pending)" : ""}</span>
        )}
      </td>
      <td className="py-3 pr-3">
        <RefundStatusBadge status={refund.status} />
        {refund.failureReason && <p className="mt-1 max-w-xs text-xs text-red-600">{refund.failureReason}</p>}
        {refund.processedAt && <p className="mt-1 text-xs text-slate-500">{formatDateTime(refund.processedAt)}</p>}
      </td>
      <td className="py-3 font-mono text-xs text-slate-600">
        {refund.razorpayRefundId ?? "—"}
        {refund.acquirerReference && <p className="text-slate-400">ARN {refund.acquirerReference}</p>}
      </td>
    </tr>
  );
}

export function PaymentDetailPage() {
  const { id = "" } = useParams();
  const { data: payment, error, isPending } = usePayment(id);
  const reconcile = useReconcilePayment();
  const [refundOpen, setRefundOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<PaymentDetail["duplicateCaptures"][number] | null>(null);
  const [reviewing, setReviewing] = useState<Refund | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (isPending)
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading payment…
      </p>
    );
  if (error || !payment)
    return (
      <p className="flex items-center gap-2 text-sm text-red-600">
        <XCircle className="h-4 w-4" aria-hidden /> {error?.message ?? "Payment not found"}
      </p>
    );

  const online = payment.gateway === "RAZORPAY";
  const canRefund = online && payment.refundable >= 1;
  const unrefundedDuplicates = payment.duplicateCaptures.filter((entry) => entry.refundState !== "FULL");
  const refundSummary = payment.refund;
  const onRefunded = (refund: Refund) => {
    setRefundOpen(false);
    setDuplicate(null);
    setDone(
      refund.status === "PROCESSED"
        ? `Refunded ${formatMoney(refund.amount)}.`
        : refund.status === "PENDING"
          ? `Refund of ${formatMoney(refund.amount)} accepted by Razorpay — processing.`
          : `Refund of ${formatMoney(refund.amount)} sent; confirming with Razorpay.`,
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link to="/payments" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-bhagwa-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Payments
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-midnight">
            Payment <span className="font-mono text-lg">{payment.id.slice(-8).toUpperCase()}</span>
            <PaymentStatusBadge status={payment.status} />
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            {formatMoney(payment.amount)} for ride
            <Link to={`/rides/${payment.rideId}`} className="font-mono text-bhagwa-600 hover:underline">
              {payment.rideCode}
            </Link>
            · ride payment <RidePaymentBadge status={payment.ridePaymentStatus} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {online && (
            <button
              type="button"
              onClick={() => reconcile.mutate(payment.id)}
              disabled={reconcile.isPending}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${reconcile.isPending ? "animate-spin" : ""}`} aria-hidden />
              Check with Razorpay
            </button>
          )}
          {canRefund && (
            <button
              type="button"
              onClick={() => {
                setDone(null);
                setRefundOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Undo2 className="h-4 w-4" aria-hidden /> Refund
            </button>
          )}
        </div>
      </header>
      {reconcile.error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{reconcile.error.message}</p>}
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {done}
        </p>
      )}

      {unrefundedDuplicates.length > 0 && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">The customer paid this ride more than once.</p>
            <p>These payments are not counted as revenue. Refund them to the customer:</p>
            <ul className="mt-2 space-y-2">
              {unrefundedDuplicates.map((entry) => (
                <li key={entry.razorpayPaymentId} className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs">{entry.razorpayPaymentId}</span>
                  <span className="font-semibold">{formatMoney(entry.amount)}</span>
                  <span className="text-xs">{formatDateTime(entry.detectedAt)}</span>
                  {entry.refundState === "PENDING" ? (
                    <Pill tone="amber">Refund processing</Pill>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDone(null);
                        setDuplicate(entry);
                      }}
                      className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Refund duplicate
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Payment" className="lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" value={`${formatMoney(payment.amount)} ${payment.currency}`} />
            <Field label="Gateway" value={payment.gateway === "CASH" ? "Cash to driver" : titleCase(payment.gateway)} />
            <Field label="Razorpay order ID" value={payment.razorpayOrderId} mono />
            <Field label="Razorpay payment ID" value={payment.razorpayPaymentId} mono />
            <Field label="Payment method" value={methodLabel(payment.method, payment.methodDetails)} />
            <Field label="Failure reason" value={payment.failureReason} />
            <Field label="Created" value={formatDateTime(payment.createdAt)} />
            <Field label="Paid" value={formatDateTime(payment.paidAt)} />
          </dl>
          {online && (refundSummary || payment.refundable > 0) && (
            <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Refunded</p>
                <p className="text-lg font-semibold tabular-nums text-midnight">{formatMoney(refundSummary?.amount ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Processing</p>
                <p className="text-lg font-semibold tabular-nums text-amber-700">{formatMoney(refundSummary?.pending ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Refundable</p>
                <p className="text-lg font-semibold tabular-nums text-emerald-700">{formatMoney(payment.refundable)}</p>
              </div>
            </div>
          )}
        </Section>

        <Section title="Commission split">
          {payment.earning ? (
            <dl className="space-y-3">
              <Field label="Gross fare" value={formatMoney(payment.earning.grossFare)} />
              <Field
                label={`Tirvona commission (${payment.earning.commissionRate}%)`}
                value={formatMoney(payment.earning.commissionAmount)}
              />
              <Field label="Driver earning" value={formatMoney(payment.earning.netEarning)} />
              <Field label="Earning status" value={<EarningStatusBadge status={payment.earning.status as EarningStatus} />} />
              {payment.adjustments.length > 0 && (
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Refund deductions</p>
                  {payment.adjustments.map((adjustment) => (
                    <p key={adjustment.id} className="mt-1 flex justify-between text-sm text-amber-900">
                      <span>{titleCase(adjustment.status)}</span>
                      <span className="tabular-nums">− {formatMoney(adjustment.amount)}</span>
                    </p>
                  ))}
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Recorded once the payment is captured.</p>
          )}
        </Section>

        <Section title="Ride & people">
          <dl className="space-y-3">
            <Field label="Customer" value={payment.customer ? `${payment.customer.name} · ${payment.customer.phone}` : undefined} />
            <Field
              label="Driver"
              value={
                payment.driver ? (
                  <Link to={`/earnings/${payment.driver.driverId}`} className="text-bhagwa-600 hover:underline">
                    {payment.driver.name} · {payment.driver.driverCode}
                  </Link>
                ) : undefined
              }
            />
            {payment.ride && (
              <>
                <Field label="Route" value={`${payment.ride.pickupAddress} → ${payment.ride.destinationAddress}`} />
                <Field label="Ride completed" value={formatDateTime(payment.ride.completedAt)} />
              </>
            )}
          </dl>
        </Section>

        <Section
          title="Final bill"
          action={<Route className="h-4 w-4 text-slate-400" aria-hidden />}
        >
          <FinalBill payment={payment} />
        </Section>

        <Section title="Attempts (Razorpay orders)">
          <ul className="space-y-3">
            {payment.attemptLog.length === 0 && <li className="text-sm text-slate-500">No online attempt.</li>}
            {payment.attemptLog.map((attempt) => (
              <li key={attempt.orderId} className="rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{attempt.orderId}</span>
                  <Pill tone={attempt.status === "PAID" ? "green" : attempt.status === "FAILED" ? "red" : "slate"}>
                    {titleCase(attempt.status)}
                  </Pill>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatMoney(attempt.amount)} · {formatDateTime(attempt.createdAt)}
                  {attempt.razorpayPaymentId && <span className="font-mono"> · {attempt.razorpayPaymentId}</span>}
                </p>
                {attempt.failureReason && <p className="text-xs text-red-600">{attempt.failureReason}</p>}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Refunds" className="lg:col-span-3">
          {payment.refunds.length === 0 ? (
            <p className="text-sm text-slate-500">
              {canRefund ? "No refunds yet. Use Refund to return money to the customer's original payment method." : "No refunds."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Requested</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Reason</th>
                    <th className="py-2 pr-3 font-medium">Borne by</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Razorpay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payment.refunds.map((refund) => (
                    <RefundRow key={refund.id} refund={refund} onReview={setReviewing} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Audit trail" className="lg:col-span-3">
          <ol className="space-y-2">
            {payment.events.map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="w-36 shrink-0 text-xs text-slate-500">{formatDateTime(event.at)}</span>
                <span className="font-medium text-slate-900">{titleCase(event.type)}</span>
                <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{titleCase(event.source)}</span>
                {event.fromStatus && event.toStatus && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    {titleCase(event.fromStatus)} <ArrowRight className="h-3 w-3" aria-hidden /> {titleCase(event.toStatus)}
                  </span>
                )}
                {event.amount !== undefined && <span className="text-xs tabular-nums text-slate-700">{formatMoney(event.amount)}</span>}
                {event.razorpayPaymentId && <span className="font-mono text-xs text-slate-500">{event.razorpayPaymentId}</span>}
                {event.detail && <span className="text-xs text-slate-600">{event.detail}</span>}
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {refundOpen && <RefundDialog payment={payment} onClose={() => setRefundOpen(false)} onDone={onRefunded} />}
      {duplicate && (
        <DuplicateRefundDialog payment={payment} duplicate={duplicate} onClose={() => setDuplicate(null)} onDone={onRefunded} />
      )}
      {reviewing && (
        <ReviewRefundDialog
          refund={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            setDone("Decision saved.");
          }}
        />
      )}
    </div>
  );
}
