import { Link, useSearchParams } from "react-router-dom";
import { Loader2, MapPin, ShieldAlert, XCircle } from "lucide-react";
import { FilterTabs, Pager, timeAgo } from "@/components/DetailUi";
import { formatDateTime, titleCase } from "@/lib/format";
import { StatCard } from "@/features/payments/components/PaymentBadges";
import { SOS_STATUSES, mapsLink, useSosList, useSosSummary } from "../api/sos";
import type { SosFilters, SosListItem, SosStatus } from "../api/sos";
import { SosStatusBadge } from "../components/SosBadges";

type Tab = SosStatus | "OPEN";
const TABS: readonly (Tab | undefined)[] = ["OPEN", undefined, ...SOS_STATUSES];

function SosRow({ sos }: { sos: SosListItem }) {
  const urgent = sos.status === "TRIGGERED";
  return (
    <tr className={urgent ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}>
      <td className="px-5 py-3">
        <Link to={`/safety/${sos.id}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
          {sos.sosCode}
        </Link>
      </td>
      <td className="px-5 py-3">
        <Link to={`/rides/${sos.rideId}`} className="font-mono text-xs text-slate-700 hover:underline">
          {sos.rideCode}
        </Link>
        <p className="text-xs text-slate-500">{titleCase(sos.rideStatus)}</p>
      </td>
      <td className="px-5 py-3">
        <p className="font-medium text-slate-900">{sos.raisedBy?.name ?? "—"}</p>
        <p className="text-xs text-slate-500">
          {titleCase(sos.raisedByRole)} · {sos.raisedBy?.phone}
        </p>
      </td>
      <td className="px-5 py-3">
        {sos.driver ? (
          <>
            <p className="font-medium text-slate-900">{sos.driver.name}</p>
            <p className="text-xs text-slate-500">
              {sos.driver.driverCode} · {sos.vehiclePlate ?? "—"}
            </p>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-5 py-3">
        <a
          href={mapsLink(sos.location.latitude, sos.location.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-bhagwa-600"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {sos.location.address ?? `${sos.location.latitude.toFixed(4)}, ${sos.location.longitude.toFixed(4)}`}
        </a>
      </td>
      <td className="px-5 py-3">
        <SosStatusBadge status={sos.status} />
      </td>
      <td className="px-5 py-3 text-xs text-slate-600">
        {formatDateTime(sos.triggeredAt)}
        {urgent && <p className="font-semibold text-red-700">{timeAgo(sos.triggeredAt)}</p>}
      </td>
      <td className="px-5 py-3 text-right">
        <Link
          to={`/safety/${sos.id}`}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            urgent ? "bg-red-600 text-white hover:bg-red-700" : "text-bhagwa-600 hover:bg-bhagwa-100"
          }`}
        >
          {urgent ? "Respond" : "View"}
        </Link>
      </td>
    </tr>
  );
}

export function SafetyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get("status");
  const tab: Tab | undefined =
    rawStatus === null ? "OPEN" : rawStatus === "ALL" ? undefined : (SOS_STATUSES.find((s) => s === rawStatus) ?? "OPEN");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const filters: SosFilters = {
    page,
    status: tab && tab !== "OPEN" ? tab : undefined,
    open: tab === "OPEN",
  };
  const { data, error, isPending, isFetching } = useSosList(filters);
  const { data: summary } = useSosSummary();

  function go(next: { tab?: Tab; page?: number }) {
    const params: Record<string, string> = {};
    const nextTab = "tab" in next ? next.tab : tab;
    if (nextTab !== "OPEN") params.status = nextTab ?? "ALL";
    if (next.page && next.page > 1) params.page = String(next.page);
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-midnight">
          <ShieldAlert className="h-6 w-6 text-red-600" aria-hidden /> Safety & SOS
        </h1>
        <p className="text-sm text-slate-500">
          Emergency alerts raised by riders and drivers — refreshes every 10 seconds. Open alerts are listed oldest first.
        </p>
      </header>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Waiting for response" value={String(summary.unacknowledged)} hint={summary.oldestUnacknowledgedAt ? `Oldest ${timeAgo(summary.oldestUnacknowledgedAt)}` : "None waiting"} />
          <StatCard label="Acknowledged" value={String(summary.acknowledged)} />
          <StatCard label="In progress" value={String(summary.inProgress)} />
          <StatCard label="Resolved today" value={String(summary.resolvedToday)} />
        </div>
      )}

      <FilterTabs<Tab>
        label="Filter by status"
        options={TABS}
        value={tab}
        onChange={(value) => go({ tab: value, page: 1 })}
        render={(value) => (value === undefined ? "All" : value === "OPEN" ? "Active" : titleCase(value))}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {isPending ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading alerts…
          </p>
        ) : error ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-red-600">
            <XCircle className="h-4 w-4" aria-hidden /> {error.message}
          </p>
        ) : data.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {tab === "OPEN" ? "No active SOS alerts. All clear." : "No alerts match this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">SOS</th>
                  <th className="px-5 py-3 font-medium">Ride</th>
                  <th className="px-5 py-3 font-medium">Raised by</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((sos) => (
                  <SosRow key={sos.id} sos={sos} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pager
            page={data.page}
            limit={data.limit}
            count={data.items.length}
            total={data.total}
            hasMore={data.hasMore}
            fetching={isFetching}
            onPage={(next) => go({ page: next })}
          />
        )}
      </section>
    </div>
  );
}
