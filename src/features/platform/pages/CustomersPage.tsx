import { useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Field, FilterTabs, Pager, Section } from "@/components/DetailUi";
import { Button, ConfirmDialog, LoadState, Notice, PageHeader, Pill, SearchBox, StatCard, Table, cell } from "@/components/Ui";
import { RideStatusBadge } from "@/features/rides/components/RideStatusBadge";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCustomer, useCustomers, useSetCustomerBlocked } from "../api";
import type { AccountStatus } from "../api";

const statusTone = (status: AccountStatus) => (status === "BLOCKED" ? "red" : status === "ACTIVE" ? "green" : "slate");

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("q") ?? "";
  const status = (["ACTIVE", "BLOCKED"] as const).find((value) => value === params.get("status"));
  const { data, error, isPending, isFetching } = useCustomers({ page, search, status });

  function update(next: { q?: string; status?: AccountStatus; page?: number }) {
    const merged = { q: search, status, page: 1, ...next };
    const out: Record<string, string> = {};
    if (merged.q) out.q = merged.q;
    if (merged.status) out.status = merged.status;
    if (merged.page > 1) out.page = String(merged.page);
    setParams(out);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Customers" subtitle="Find a customer, see their rides and money, block or unblock the account" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs<AccountStatus>
          label="Account status"
          options={[undefined, "ACTIVE", "BLOCKED"]}
          value={status}
          onChange={(value) => update({ status: value })}
          render={(value) => (value ? (value === "ACTIVE" ? "Active" : "Blocked") : "All")}
        />
        <SearchBox value={search} onChange={(q) => update({ q })} placeholder="Name, phone or email" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No customers match.">
          {data && (
            <>
              <Table head={["Customer", "Phone", "Rides", "Status", "Joined", ""]}>
                {data.items.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <td className={`${cell} font-medium text-slate-900`}>
                      {customer.name}
                      {customer.email && <span className="block text-xs font-normal text-slate-500">{customer.email}</span>}
                    </td>
                    <td className={`${cell} text-slate-600`}>
                      {customer.phone}
                      {!customer.isPhoneVerified && <span className="block text-xs text-amber-700">Not verified</span>}
                    </td>
                    <td className={`${cell} tabular-nums`}>{customer.totalRides}</td>
                    <td className={cell}>
                      <Pill tone={statusTone(customer.status)}>{customer.status}</Pill>
                    </td>
                    <td className={`${cell} text-slate-500`}>{formatDateTime(customer.createdAt)}</td>
                    <td className={`${cell} text-right`}>
                      <Link to={`/customers/${customer.id}`} className="inline-flex items-center gap-1 font-semibold text-bhagwa-600 hover:underline">
                        View <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </Table>
              <Pager page={data.page} limit={data.limit} count={data.items.length} total={data.total} hasMore={data.hasMore} fetching={isFetching} onPage={(next) => update({ page: next })} />
            </>
          )}
        </LoadState>
      </section>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { data, error, isPending } = useCustomer(id);
  const setBlocked = useSetCustomerBlocked();
  const [confirming, setConfirming] = useState<"block" | "unblock" | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All customers
      </Link>
      <LoadState pending={isPending} error={error}>
        {data && (
          <>
            <PageHeader
              title={[data.customer.firstName, data.customer.lastName].filter(Boolean).join(" ")}
              subtitle={`${data.customer.phone}${data.customer.email ? ` · ${data.customer.email}` : ""}`}
              actions={
                data.customer.status === "BLOCKED" ? (
                  <Button onClick={() => setConfirming("unblock")}>Unblock</Button>
                ) : (
                  <Button variant="danger" onClick={() => setConfirming("block")}>
                    Block account
                  </Button>
                )
              }
            />
            {data.customer.status === "BLOCKED" && (
              <Notice tone="warning">
                Blocked {formatDateTime(data.customer.statusChangedAt)}
                {data.customer.statusReason ? `: ${data.customer.statusReason}` : ""}. The customer is signed out and cannot book.
              </Notice>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Rides" value={data.stats.totalRides} hint={`${data.stats.completedRides} completed · ${data.stats.cancelledRides} cancelled`} />
              <StatCard label="Paid to date" value={formatMoney(data.stats.totalPaid)} />
              <StatCard
                label="Cancellation fees due"
                value={formatMoney(data.stats.outstandingCancellationFees)}
                hint={`${data.stats.outstandingCancellationCount} unpaid`}
                tone={data.stats.outstandingCancellationFees > 0 ? "warn" : "default"}
                to="/cancellations?feeStatus=DUE"
              />
              <StatCard label="Complaints" value={data.stats.complaints} to="/complaints" />
            </div>
            <Section title="Account">
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Status" value={<Pill tone={statusTone(data.customer.status)}>{data.customer.status}</Pill>} />
                <Field label="Phone verified" value={data.customer.isPhoneVerified ? "Yes" : "No"} />
                <Field label="Joined" value={formatDateTime(data.customer.createdAt)} />
                <Field label="Last sign-in" value={formatDateTime(data.customer.lastLoginAt)} />
              </dl>
            </Section>
            <Section title="Recent rides">
              {data.recentRides.length === 0 ? (
                <p className="text-sm text-slate-500">No rides yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentRides.map((ride) => (
                    <li key={ride.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <Link to={`/rides/${ride.id}`} className="font-mono font-semibold text-bhagwa-600 hover:underline">
                        {ride.rideCode}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-slate-600">
                        {ride.pickup.address} → {ride.destination.address}
                      </span>
                      <span className="tabular-nums">{formatMoney(ride.fare.payableFare ?? ride.fare.finalFare ?? ride.fare.estimatedFare)}</span>
                      <RideStatusBadge status={ride.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <p className="text-sm">
              <Link className="font-semibold text-bhagwa-600 hover:underline" to={`/audit-log?targetType=CUSTOMER&targetId=${data.customer.id}`}>
                Admin action history
              </Link>
            </p>
            {confirming && (
              <ConfirmDialog
                title={confirming === "block" ? "Block this customer?" : "Unblock this customer?"}
                body={
                  confirming === "block"
                    ? "They are signed out on every device and cannot use the app until unblocked. Refused while they have a ride in progress."
                    : "They can sign in and book again."
                }
                confirmLabel={confirming === "block" ? "Block account" : "Unblock"}
                danger={confirming === "block"}
                reasonLabel={confirming === "block" ? "Reason for blocking" : "Note"}
                reasonRequired={confirming === "block"}
                busy={setBlocked.isPending}
                error={setBlocked.error?.message}
                onCancel={() => {
                  setBlocked.reset();
                  setConfirming(null);
                }}
                onConfirm={(reason) =>
                  setBlocked.mutate({ id, block: confirming === "block", reason }, { onSuccess: () => setConfirming(null) })
                }
              />
            )}
          </>
        )}
      </LoadState>
    </div>
  );
}
