import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Search, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { PAYMENT_STATUSES, usePayments, usePaymentsSummary } from "../api/payments";
import type { PaymentFilters, PaymentGateway, PaymentListItem, PaymentStatus } from "../api/payments";
import { PaymentStatusBadge, StatCard } from "../components/PaymentBadges";

const TEXT_FILTERS = [
  { key: "payment", label: "Payment ID", placeholder: "Payment id, pay_… or order_…" },
  { key: "ride", label: "Ride", placeholder: "Ride code or id" },
  { key: "customer", label: "Customer", placeholder: "Phone or name" },
  { key: "driver", label: "Driver", placeholder: "Driver code, phone or name" },
] as const;
type TextFilter = (typeof TEXT_FILTERS)[number]["key"];

const parseStatus = (value: string | null) => PAYMENT_STATUSES.find((status) => status === value);

const GATEWAY_FILTERS: Array<{ value?: PaymentGateway; label: string }> = [
  { value: undefined, label: "All methods" },
  { value: "RAZORPAY", label: "Online" },
  { value: "CASH", label: "Cash" },
];
const parseGateway = (value: string | null) => GATEWAY_FILTERS.find((option) => option.value === value)?.value;
const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500";

function PaymentRow({ payment }: { payment: PaymentListItem }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-3">
        <Link to={`/payments/${payment.id}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
          {payment.id.slice(-8).toUpperCase()}
        </Link>
        {payment.needsAttention && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-600" title="Duplicate capture — refund required">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Refund
          </span>
        )}
      </td>
      <td className="px-5 py-3">
        <Link to={`/rides/${payment.rideId}`} className="font-mono text-xs text-slate-700 hover:underline">
          {payment.rideCode}
        </Link>
      </td>
      <td className="px-5 py-3">
        <p className="font-medium text-slate-900">{payment.customer?.name || "—"}</p>
        <p className="text-xs text-slate-500">{payment.customer?.phone}</p>
      </td>
      <td className="px-5 py-3">
        {payment.driver ? (
          <>
            <p className="font-medium text-slate-900">{payment.driver.name}</p>
            <p className="font-mono text-xs text-slate-500">{payment.driver.driverCode}</p>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-5 py-3 text-right font-medium text-slate-900">{formatMoney(payment.amount)}</td>
      <td className="px-5 py-3 text-slate-700">
        {payment.gateway === "CASH" ? "Cash to driver" : titleCase(payment.gateway)}
        {payment.method && payment.gateway !== "CASH" && (
          <p className="text-xs uppercase text-slate-500">{payment.method}</p>
        )}
      </td>
      <td className="px-5 py-3 font-mono text-xs text-slate-600">{payment.razorpayPaymentId ?? "—"}</td>
      <td className="px-5 py-3">
        <PaymentStatusBadge status={payment.status} />
      </td>
      <td className="px-5 py-3 text-xs text-slate-600">{formatDateTime(payment.paidAt ?? payment.createdAt)}</td>
    </tr>
  );
}

function Summary() {
  const { data } = usePaymentsSummary();
  if (!data) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        label="Collected online today"
        value={formatMoney(data.collectedToday)}
        hint={`${data.capturedToday} payments · ${formatMoney(data.collectedTotal)} all time`}
      />
      <StatCard
        label="Cash to drivers today"
        value={formatMoney(data.cashToday)}
        hint={`${data.cashRidesToday} rides · ${formatMoney(data.cashTotal)} all time (${data.cashRidesTotal})`}
      />
      <StatCard
        label="Commission due on cash"
        value={formatMoney(data.commissionDue)}
        hint="Owed by drivers who kept cash fares"
      />
      <StatCard label="Tirvona commission" value={formatMoney(data.commissionTotal)} hint="From the earnings ledger" />
      <StatCard
        label="Unpaid completed rides"
        value={String(data.outstandingRides)}
        hint={`${formatMoney(data.outstandingAmount)} outstanding · ${data.failedToday} failed today${
          data.needsAttention ? ` · ${data.needsAttention} need refund` : ""
        }`}
      />
    </div>
  );
}

export function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: PaymentFilters = {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    status: parseStatus(searchParams.get("status")),
    gateway: parseGateway(searchParams.get("gateway")),
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    payment: searchParams.get("payment") ?? undefined,
    ride: searchParams.get("ride") ?? undefined,
    customer: searchParams.get("customer") ?? undefined,
    driver: searchParams.get("driver") ?? undefined,
  };
  const [draft, setDraft] = useState<Record<TextFilter | "from" | "to", string>>({
    payment: "",
    ride: "",
    customer: "",
    driver: "",
    from: "",
    to: "",
  });
  const serialized = searchParams.toString();
  useEffect(() => {
    setDraft({
      payment: searchParams.get("payment") ?? "",
      ride: searchParams.get("ride") ?? "",
      customer: searchParams.get("customer") ?? "",
      driver: searchParams.get("driver") ?? "",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
    });
  }, [serialized]);

  const { data, error, isPending, isFetching } = usePayments(filters);

  function apply(next: Partial<PaymentFilters>) {
    const merged = { ...filters, page: 1, ...next };
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(merged))
      if (value !== undefined && value !== "" && !(key === "page" && value === 1)) params[key] = String(value);
    setSearchParams(params);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({
      payment: draft.payment.trim() || undefined,
      ride: draft.ride.trim() || undefined,
      customer: draft.customer.trim() || undefined,
      driver: draft.driver.trim() || undefined,
      from: draft.from || undefined,
      to: draft.to || undefined,
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-midnight">Payments</h1>
        <p className="text-sm text-slate-500">
          Ride payments — online via Razorpay (verified by the backend) or cash to the driver — refreshes every 15 seconds
        </p>
      </header>

      <Summary />

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl shadow-sm border border-slate-200 bg-white p-4 md:grid-cols-4 lg:grid-cols-7">
        {TEXT_FILTERS.map(({ key, label, placeholder }) => (
          <label key={key} className="block">
            <span className="text-xs font-medium text-slate-600">{label}</span>
            <input
              value={draft[key]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              placeholder={placeholder}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        ))}
        <label className="block">
          <span className="text-xs font-medium text-slate-600">From</span>
          <input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">To</span>
          <input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-bhagwa-500 px-4 py-2 text-sm font-semibold text-white hover:bg-bhagwa-600">
            <Search className="h-4 w-4" aria-hidden /> Filter
          </button>
          <button type="button" onClick={() => setSearchParams({})} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Clear
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by how the ride was paid">
        {GATEWAY_FILTERS.map(({ value, label }) => {
          const active = value === filters.gateway;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => apply({ gateway: value })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                active ? "bg-midnight text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {([undefined, ...PAYMENT_STATUSES] as Array<PaymentStatus | undefined>).map((status) => {
          const active = status === filters.status;
          return (
            <button
              key={status ?? "ALL"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => apply({ status })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                active ? "bg-bhagwa-500 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {status ? titleCase(status) : "All"}
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading payments…
          </p>
        ) : error ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-red-600">
            <XCircle className="h-4 w-4" aria-hidden /> {error.message}
          </p>
        ) : data.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No payments match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">Ride</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Gateway</th>
                  <th className="px-5 py-3 font-medium">Gateway payment ID</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              {(data.page - 1) * data.limit + 1}–{(data.page - 1) * data.limit + data.items.length} of {data.total}
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="Refreshing" />}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => apply({ page: filters.page - 1 })}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
              </button>
              <button
                type="button"
                disabled={!data.hasMore}
                onClick={() => apply({ page: filters.page + 1 })}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </span>
          </footer>
        )}
      </section>
    </div>
  );
}
