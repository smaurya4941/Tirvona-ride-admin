import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Search, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterTabs, Pager } from "@/components/DetailUi";
import { formatDateTime, titleCase } from "@/lib/format";
import { StatCard } from "@/features/payments/components/PaymentBadges";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  useComplaintSummary,
  useComplaints,
} from "../api/complaints";
import type { ComplaintFilters, ComplaintListItem, ComplaintStatus } from "../api/complaints";
import { ComplaintStatusBadge, PriorityBadge } from "../components/ComplaintBadges";

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500";

function Row({ complaint }: { complaint: ComplaintListItem }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-3">
        <Link to={`/complaints/${complaint.id}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
          {complaint.ticketCode}
        </Link>
      </td>
      <td className="max-w-xs px-5 py-3">
        <p className="truncate font-medium text-slate-900">{complaint.subject}</p>
        <p className="text-xs text-slate-500">{titleCase(complaint.category)}</p>
      </td>
      <td className="px-5 py-3">
        <p className="font-medium text-slate-900">{complaint.user?.name ?? "—"}</p>
        <p className="text-xs text-slate-500">
          {titleCase(complaint.userRole)} · {complaint.user?.phone}
        </p>
      </td>
      <td className="px-5 py-3">
        {complaint.rideId ? (
          <Link to={`/rides/${complaint.rideId}`} className="font-mono text-xs text-slate-700 hover:underline">
            {complaint.rideCode}
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="px-5 py-3">{complaint.driver ? <p className="text-slate-900">{complaint.driver.name}</p> : "—"}</td>
      <td className="px-5 py-3">
        <PriorityBadge priority={complaint.priority} />
      </td>
      <td className="px-5 py-3">
        <ComplaintStatusBadge status={complaint.status} />
      </td>
      <td className="px-5 py-3 text-xs text-slate-600">{complaint.assignedAdmin?.name ?? "Unassigned"}</td>
      <td className="px-5 py-3 text-xs text-slate-600">{formatDateTime(complaint.createdAt)}</td>
    </tr>
  );
}

export function ComplaintsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: ComplaintFilters = {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    status: COMPLAINT_STATUSES.find((value) => value === searchParams.get("status")),
    category: COMPLAINT_CATEGORIES.find((value) => value === searchParams.get("category")),
    priority: COMPLAINT_PRIORITIES.find((value) => value === searchParams.get("priority")),
    search: searchParams.get("search") ?? undefined,
  };
  const [search, setSearch] = useState(filters.search ?? "");
  const serialized = searchParams.toString();
  useEffect(() => setSearch(searchParams.get("search") ?? ""), [serialized]);

  const { data, error, isPending, isFetching } = useComplaints(filters);
  const { data: summary } = useComplaintSummary();

  function apply(next: Partial<ComplaintFilters>) {
    const merged = { ...filters, page: 1, ...next };
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(merged))
      if (value !== undefined && value !== "" && !(key === "page" && value === 1)) params[key] = String(value);
    setSearchParams(params);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({ search: search.trim() || undefined });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-midnight">Complaints</h1>
        <p className="text-sm text-slate-500">Issues reported by riders and drivers, optionally about a ride</p>
      </header>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open" value={String(summary.open)} hint="Not yet picked up" />
          <StatCard label="In review" value={String(summary.inReview)} />
          <StatCard label="Urgent & unresolved" value={String(summary.urgentOpen)} hint="Safety complaints" />
          <StatCard label="Resolved today" value={String(summary.resolvedToday)} />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <form onSubmit={handleSearch} className="flex flex-1 items-end gap-2">
          <label className="block flex-1">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ticket, ride code, phone or name"
              className={`mt-1 w-full ${selectClass}`}
            />
          </label>
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-bhagwa-500 px-4 py-2 text-sm font-semibold text-white hover:bg-bhagwa-600">
            <Search className="h-4 w-4" aria-hidden /> Search
          </button>
        </form>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Category</span>
          <select
            value={filters.category ?? ""}
            onChange={(event) => apply({ category: (event.target.value || undefined) as ComplaintFilters["category"] })}
            className={`mt-1 block ${selectClass}`}
          >
            <option value="">All categories</option>
            {COMPLAINT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {titleCase(category)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Priority</span>
          <select
            value={filters.priority ?? ""}
            onChange={(event) => apply({ priority: (event.target.value || undefined) as ComplaintFilters["priority"] })}
            className={`mt-1 block ${selectClass}`}
          >
            <option value="">Any priority</option>
            {COMPLAINT_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {titleCase(priority)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setSearchParams({})} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Clear
        </button>
      </div>

      <FilterTabs<ComplaintStatus>
        label="Filter by status"
        options={[undefined, ...COMPLAINT_STATUSES]}
        value={filters.status}
        onChange={(status) => apply({ status })}
        render={(value) => (value ? titleCase(value) : "All")}
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading complaints…
          </p>
        ) : error ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-red-600">
            <XCircle className="h-4 w-4" aria-hidden /> {error.message}
          </p>
        ) : data.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No complaints match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Ticket</th>
                  <th className="px-5 py-3 font-medium">Issue</th>
                  <th className="px-5 py-3 font-medium">Reported by</th>
                  <th className="px-5 py-3 font-medium">Ride</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((complaint) => (
                  <Row key={complaint.id} complaint={complaint} />
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
            onPage={(page) => apply({ page })}
          />
        )}
      </section>
    </div>
  );
}
