import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterTabs, Pager } from "@/components/DetailUi";
import { LoadState, Notice, PageHeader, Pill } from "@/components/Ui";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { useRefunds } from "../api/payments";
import type { Refund, RefundStatus } from "../api/payments";
import { RefundStatusBadge, ReviewRefundDialog, refundReasonLabel } from "../components/RefundDialogs";

const STATUSES: readonly (RefundStatus | undefined)[] = [undefined, "PENDING", "PROCESSED", "FAILED", "REQUESTED"];
const STATUS_LABELS: Record<RefundStatus, string> = {
  REQUESTED: "Confirming",
  PENDING: "Processing",
  PROCESSED: "Refunded",
  FAILED: "Failed",
};

/** Every refund — admin and dashboard — with the ones awaiting a decision first. */
export function RefundsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const status = STATUSES.find((value) => value && value === params.get("status"));
  const needsReview = params.get("review") === "1" ? true : undefined;
  const { data, error, isPending, isFetching } = useRefunds({ page, status, needsReview });
  const [reviewing, setReviewing] = useState<Refund | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const set = (next: Record<string, string | undefined>) => {
    const merged: Record<string, string> = {};
    const current = { status, review: needsReview ? "1" : undefined, ...next };
    for (const [key, value] of Object.entries(current)) if (value) merged[key] = value;
    setParams(merged);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link to="/payments" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-bhagwa-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Payments
      </Link>
      <PageHeader
        title="Refunds"
        subtitle="Money returned to customers through Razorpay — requested here or in the Razorpay dashboard"
      />
      {done && <Notice tone="success">{done}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Filter by refund status"
          options={STATUSES}
          value={status}
          onChange={(value) => set({ status: value, page: undefined })}
          render={(value) => (value ? STATUS_LABELS[value] : "All")}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(needsReview)}
            onChange={(event) => set({ review: event.target.checked ? "1" : undefined, page: undefined })}
          />
          Only dashboard refunds to review
        </label>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No refunds match these filters.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Requested</th>
                  <th className="px-5 py-3 font-medium">Ride</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">Borne by</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Razorpay refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((refund) => (
                  <tr key={refund.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {formatDateTime(refund.createdAt)}
                      <p className="text-slate-400">{refund.requestedBy?.name ?? titleCase(refund.source)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Link to={`/payments/${refund.paymentId}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
                        {refund.rideCode}
                      </Link>
                      {refund.target === "DUPLICATE_CAPTURE" && (
                        <div className="mt-1">
                          <Pill tone="amber">Duplicate</Pill>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{refund.customer?.name ?? "—"}</p>
                      <p className="text-xs text-slate-500">{refund.customer?.phone}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(refund.amount)}</td>
                    <td className="px-5 py-3">
                      {refundReasonLabel(refund.reason)}
                      {refund.note && <p className="max-w-xs text-xs text-slate-500">{refund.note}</p>}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {refund.needsReview ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDone(null);
                            setReviewing(refund);
                          }}
                          className="rounded-lg bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-200"
                        >
                          Review
                        </button>
                      ) : refund.driverImpact === "NONE" ? (
                        "Tirvona"
                      ) : (
                        <span className="text-amber-700">
                          Driver{refund.adjustment?.amount !== undefined ? ` −${formatMoney(refund.adjustment.amount)}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <RefundStatusBadge status={refund.status} />
                      {refund.failureReason && <p className="mt-1 max-w-xs text-xs text-red-600">{refund.failureReason}</p>}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">
                      {refund.razorpayRefundId ?? "—"}
                      {refund.acquirerReference && <p className="text-slate-400">ARN {refund.acquirerReference}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadState>
        {data && (
          <Pager
            page={data.page}
            limit={data.limit}
            count={data.items.length}
            total={data.total}
            hasMore={data.hasMore}
            fetching={isFetching}
            onPage={(next) => set({ page: String(next) })}
          />
        )}
      </section>

      {reviewing && (
        <ReviewRefundDialog
          refund={reviewing}
          onClose={() => setReviewing(null)}
          onDone={(refund) => {
            setReviewing(null);
            setDone(`Saved: ${formatMoney(refund.amount)} on ride ${refund.rideCode} is borne by ${refund.driverImpact === "NONE" ? "Tirvona" : "the driver"}.`);
          }}
        />
      )}
    </div>
  );
}
