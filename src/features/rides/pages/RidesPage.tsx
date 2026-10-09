import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { RIDE_STATUSES, RIDE_TYPES, useRides } from "../api/rides";
import type { RideListItem, RideStatus, RideTypeCode } from "../api/rides";
import { RideEndBadge } from "../components/RideEndBadge";
import { RideStatusBadge } from "../components/RideStatusBadge";
import { inputClass } from "@/components/Ui";

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
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-2.5 align-middle">
        <Link to={`/rides/${ride.id}`} className="font-mono text-[13px] font-semibold text-slate-900 hover:underline">
          {ride.rideCode}
        </Link>
        <p className="text-[11px] text-slate-500 leading-tight">{formatDateTime(ride.requestedAt)}</p>
      </td>
      <td className="px-4 py-2.5 align-middle">
        <p className="text-[13px] font-medium text-slate-900">{ride.customer?.name || "—"}</p>
        <p className="text-[11px] text-slate-500 leading-tight">{ride.customer?.phone}</p>
      </td>
      <td className="px-4 py-2.5 align-middle">
        {ride.driver ? (
          <>
            <p className="text-[13px] font-medium text-slate-900">{ride.driver.name}</p>
            <p className="font-mono text-[11px] text-slate-500 leading-tight">{ride.driver.driverCode}</p>
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-[13px] text-slate-700 align-middle">{titleCase(ride.rideType)}</td>
      <td className="max-w-xs px-4 py-2.5 align-middle">
        <p className="truncate text-[13px] text-slate-900" title={ride.pickup.address}>
          {ride.pickup.address}
        </p>
        <p className="truncate text-[11px] text-slate-500 leading-tight" title={ride.destination.address}>
          → {ride.destination.address}
        </p>
      </td>
      <td className="px-4 py-2.5 text-right font-medium text-slate-900 align-middle">
        <span className="text-[13px]">{formatMoney(fare)}</span>
        {ride.fare.finalFare === undefined && <p className="text-[10px] font-semibold uppercase text-slate-400 leading-none">estimate</p>}
      </td>
      <td className="px-4 py-2.5 align-middle">
        <RideStatusBadge status={ride.status} />
        <RideEndBadge end={ride.end} />
      </td>
    </tr>
  );
}

export function RidesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));
  const rideType = parseRideType(searchParams.get("rideType"));
  const search = searchParams.get("q") ?? "";
  const needsReview = searchParams.get("review") === "1";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => setSearchDraft(search), [search]);

  const { data, error, isPending, isFetching } = useRides({ page, status, rideType, search, needsReview });

  function update(next: { status?: RideStatus; rideType?: RideTypeCode; q?: string; page?: number; review?: boolean }) {
    const merged = { status, rideType, q: search, page: 1, review: needsReview, ...next };
    const params: Record<string, string> = {};
    if (merged.status) params.status = merged.status;
    if (merged.rideType) params.rideType = merged.rideType;
    if (merged.q) params.q = merged.q;
    if (merged.review) params.review = "1";
    if (merged.page > 1) params.page = String(merged.page);
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900">Rides</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: searchDraft.trim() });
          }}
          className="flex items-center gap-2"
        >
          <label className="relative block">
            <span className="sr-only">Search rides</span>
            <Search className="pointer-events-none absolute left-3 top-2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Ride code or phone"
              className={`${inputClass} pl-9 w-64`}
            />
          </label>
          <select
            value={rideType ?? ""}
            onChange={(event) => update({ rideType: parseRideType(event.target.value) })}
            className={`${inputClass} w-auto pr-8 bg-white`}
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
              className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
                active ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {filter ? titleCase(filter) : "All"}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={needsReview}
          onClick={() => update({ review: !needsReview })}
          title="Trips that ended without the rider's code, or far from the booked drop-off"
          className={`ml-auto rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
            needsReview ? "bg-amber-500 text-white shadow-sm" : "bg-white text-amber-700 ring-1 ring-inset ring-amber-300 hover:bg-amber-50"
          }`}
        >
          Needs review
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <p className="flex items-center gap-2 px-4 py-8 text-[13px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading rides…
          </p>
        ) : error ? (
          <p className="flex items-center gap-2 px-4 py-8 text-[13px] text-red-600">
            <XCircle className="h-4 w-4" aria-hidden /> {error.message}
          </p>
        ) : data.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-slate-500">No rides match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Ride</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Driver</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Route</th>
                  <th className="px-4 py-2 text-right font-medium">Fare</th>
                  <th className="px-4 py-2 font-medium">Status</th>
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
          <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-[13px] text-slate-600">
            <span className="flex items-center gap-2">
              {(data.page - 1) * data.limit + 1}–{(data.page - 1) * data.limit + data.items.length} of {data.total}
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="Refreshing" />}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => update({ page: page - 1 })}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Previous
              </button>
              <button
                type="button"
                disabled={!data.hasMore}
                onClick={() => update({ page: page + 1 })}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </footer>
        )}
      </section>
    </div>
  );
}
