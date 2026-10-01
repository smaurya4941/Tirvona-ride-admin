import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { RIDE_STATUSES, RIDE_TYPES, useRides } from "../api/rides";
import type { RideListItem, RideStatus, RideTypeCode } from "../api/rides";
import { RideStatusBadge } from "../components/RideStatusBadge";

const STATUS_FILTERS: Array<RideStatus | undefined> = [
  undefined,
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_ACCEPTED",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "COMPLETED",
  "CANCELLED",
  "NO_DRIVER_AVAILABLE",
];

const parseStatus = (value: string | null) => RIDE_STATUSES.find((status) => status === value);
const parseRideType = (value: string | null) => RIDE_TYPES.find((type) => type === value);

function RideRow({ ride }: { ride: RideListItem }) {
  const fare = ride.fare.finalFare ?? ride.fare.estimatedFare;
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-3">
        <Link to={`/rides/${ride.id}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
          {ride.rideCode}
        </Link>
        <p className="text-xs text-slate-500">{formatDateTime(ride.requestedAt)}</p>
      </td>
      <td className="px-5 py-3">
        <p className="font-medium text-slate-900">{ride.customer?.name || "—"}</p>
        <p className="text-xs text-slate-500">{ride.customer?.phone}</p>
      </td>
      <td className="px-5 py-3">
        {ride.driver ? (
          <>
            <p className="font-medium text-slate-900">{ride.driver.name}</p>
            <p className="font-mono text-xs text-slate-500">{ride.driver.driverCode}</p>
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-slate-700">{titleCase(ride.rideType)}</td>
      <td className="max-w-xs px-5 py-3">
        <p className="truncate text-slate-900" title={ride.pickup.address}>
          {ride.pickup.address}
        </p>
        <p className="truncate text-xs text-slate-500" title={ride.destination.address}>
          → {ride.destination.address}
        </p>
      </td>
      <td className="px-5 py-3 text-right font-medium text-slate-900">
        {formatMoney(fare)}
        {ride.fare.finalFare === undefined && <p className="text-xs font-normal text-slate-400">estimate</p>}
      </td>
      <td className="px-5 py-3">
        <RideStatusBadge status={ride.status} />
      </td>
    </tr>
  );
}

export function RidesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));
  const rideType = parseRideType(searchParams.get("rideType"));
  const search = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => setSearchDraft(search), [search]);

  const { data, error, isPending, isFetching } = useRides({ page, status, rideType, search });

  function update(next: { status?: RideStatus; rideType?: RideTypeCode; q?: string; page?: number }) {
    const merged = { status, rideType, q: search, page: 1, ...next };
    const params: Record<string, string> = {};
    if (merged.status) params.status = merged.status;
    if (merged.rideType) params.rideType = merged.rideType;
    if (merged.q) params.q = merged.q;
    if (merged.page > 1) params.page = String(merged.page);
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-midnight">Rides</h1>
          <p className="text-sm text-slate-500">Every booking, live — refreshes every 10 seconds</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: searchDraft.trim() });
          }}
          className="flex items-center gap-2"
        >
          <label className="relative">
            <span className="sr-only">Search rides</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Ride code or customer phone"
              className="w-64 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
            />
          </label>
          <select
            value={rideType ?? ""}
            onChange={(event) => update({ rideType: parseRideType(event.target.value) })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label="Ride type"
          >
            <option value="">All types</option>
            {RIDE_TYPES.map((type) => (
              <option key={type} value={type}>
                {titleCase(type)}
              </option>
            ))}
          </select>
        </form>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {STATUS_FILTERS.map((filter) => {
          const active = filter === status;
          return (
            <button
              key={filter ?? "ALL"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => update({ status: filter })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                active ? "bg-bhagwa-500 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {filter ? titleCase(filter) : "All"}
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {isPending ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading rides…
          </p>
        ) : error ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-red-600">
            <XCircle className="h-4 w-4" aria-hidden /> {error.message}
          </p>
        ) : data.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No rides match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Ride</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 text-right font-medium">Fare</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((ride) => (
                  <RideRow key={ride.id} ride={ride} />
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
                disabled={page <= 1}
                onClick={() => update({ page: page - 1 })}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
              </button>
              <button
                type="button"
                disabled={!data.hasMore}
                onClick={() => update({ page: page + 1 })}
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
