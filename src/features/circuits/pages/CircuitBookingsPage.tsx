import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { FilterTabs, Pager } from "@/components/DetailUi";
import { LoadState, PageHeader, Pill, SearchBox, Table, cell, inputClass } from "@/components/Ui";
import { RideStatusBadge } from "@/features/rides/components/RideStatusBadge";
import type { RideStatus } from "@/features/rides/api/rides";
import { formatDateTime, formatKm, formatMoney, titleCase } from "@/lib/format";
import { formatDuration, stopsDone, useCircuitBookings, useCircuitPackages } from "../api";
import type { CircuitBookingFilters } from "../api";

const STATUS_TABS: readonly (RideStatus | undefined)[] = [
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
const STATUS_LABEL: Partial<Record<RideStatus, string>> = {
  SEARCHING: "Searching",
  DRIVER_ASSIGNED: "Assigned",
  DRIVER_ACCEPTED: "Driver arriving",
  DRIVER_ARRIVED: "At pickup",
  RIDE_STARTED: "In progress",
};
const PAYMENT_STATUSES = ["PENDING", "FAILED", "SUCCESS", "REFUNDED", "NOT_REQUIRED"];

/** "2026-10-05" (local) → ISO instant with offset for the API. */
const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const dayEnd = (value: string) => (value ? new Date(new Date(`${value}T00:00:00`).getTime() + 86_400_000).toISOString() : undefined);

export function CircuitBookingsPage() {
  const [filters, setFilters] = useState<Omit<CircuitBookingFilters, "startDate" | "endDate"> & { from: string; to: string }>({ page: 1, from: "", to: "" });
  const packages = useCircuitPackages({});
  const { data, error, isPending, isFetching } = useCircuitBookings({
    page: filters.page,
    status: filters.status,
    packageId: filters.packageId,
    city: filters.city,
    paymentStatus: filters.paymentStatus,
    q: filters.q,
    startDate: dayStart(filters.from),
    endDate: dayEnd(filters.to),
  });
  const change = (patch: Partial<typeof filters>) => setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Circuit bookings" subtitle="Every circuit booked from a package, live and past. Refreshes every 10 seconds." />
      <FilterTabs options={STATUS_TABS} value={filters.status as RideStatus | undefined} onChange={(status) => change({ status })} label="Status" render={(value) => (value ? STATUS_LABEL[value] ?? titleCase(value) : "All")} />
      <div className="flex flex-wrap items-end gap-3">
        <SearchBox value={filters.q ?? ""} onChange={(q) => change({ q: q || undefined })} placeholder="Ride code or customer phone" />
        <select aria-label="Package" value={filters.packageId ?? ""} onChange={(event) => change({ packageId: event.target.value || undefined })} className={`${inputClass} w-auto`}>
          <option value="">All packages</option>
          {packages.data?.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name}
            </option>
          ))}
        </select>
        <input aria-label="City" placeholder="City" value={filters.city ?? ""} onChange={(event) => change({ city: event.target.value || undefined })} className={`${inputClass} w-32`} />
        <select aria-label="Payment" value={filters.paymentStatus ?? ""} onChange={(event) => change({ paymentStatus: event.target.value || undefined })} className={`${inputClass} w-auto`}>
          <option value="">Any payment</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {titleCase(status)}
            </option>
          ))}
        </select>
        <label className="text-xs text-slate-500">
          From
          <input type="date" value={filters.from} onChange={(event) => change({ from: event.target.value })} className={`${inputClass} mt-0.5 w-auto`} />
        </label>
        <label className="text-xs text-slate-500">
          To
          <input type="date" value={filters.to} onChange={(event) => change({ to: event.target.value })} className={`${inputClass} mt-0.5 w-auto`} />
        </label>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No circuit bookings match these filters">
          <Table head={["Booking", "Package", "Customer", "Driver", "Progress", "Time", "Distance", "Fare", "Status", "Payment"]}>
            {data?.items.map((ride) => (
              <tr key={ride.id} className="hover:bg-slate-50">
                <td className={cell}>
                  <Link to={`/circuits/bookings/${ride.id}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
                    {ride.rideCode}
                  </Link>
                  <p className="text-[11px] text-slate-500">{formatDateTime(ride.requestedAt)}</p>
                </td>
                <td className={cell}>
                  <p className="font-medium text-slate-900">{ride.circuit.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {ride.circuit.city} · {titleCase(ride.rideType)} · {ride.circuit.passengers} pax
                  </p>
                </td>
                <td className={cell}>{ride.customer?.name || "—"}</td>
                <td className={cell}>{ride.driver?.name || "—"}</td>
                <td className={cell}>
                  <span className="tabular-nums">
                    {stopsDone(ride.circuit)}/{ride.circuit.stops.length}
                  </span>
                  {ride.circuit.currentStop && <p className="text-[11px] text-slate-500">→ {ride.circuit.currentStop.name}</p>}
                  {ride.circuit.exception && (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
                      <AlertTriangle className="h-3 w-3" aria-hidden /> Needs attention
                    </p>
                  )}
                </td>
                <td className={`${cell} tabular-nums`}>
                  {ride.startedAt ? `${formatDuration(ride.circuit.usage.elapsedSeconds)} / ${formatDuration(ride.circuit.pricing.includedDurationSeconds)}` : "—"}
                </td>
                <td className={`${cell} tabular-nums`}>{ride.startedAt ? `${formatKm(ride.circuit.usage.distanceMeters)} / ${formatKm(ride.circuit.pricing.includedDistanceMeters)}` : "—"}</td>
                <td className={`${cell} tabular-nums font-semibold`}>{formatMoney(ride.fare.finalFare ?? ride.fare.estimatedFare)}</td>
                <td className={cell}>
                  <RideStatusBadge status={ride.status} />
                </td>
                <td className={cell}>
                  <Pill tone={ride.paymentStatus === "SUCCESS" ? "green" : ride.paymentStatus === "FAILED" ? "red" : ride.paymentStatus === "PENDING" ? "amber" : "slate"}>
                    {titleCase(ride.paymentStatus)}
                  </Pill>
                </td>
              </tr>
            ))}
          </Table>
          {data && (
            <Pager page={data.page} limit={data.limit} count={data.items.length} total={data.total} hasMore={data.hasMore} fetching={isFetching} onPage={(page) => change({ page })} />
          )}
        </LoadState>
      </section>
    </div>
  );
}
