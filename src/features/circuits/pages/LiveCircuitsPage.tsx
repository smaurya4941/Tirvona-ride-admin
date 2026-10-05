import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { PinMap } from "@/components/GoogleMap";
import { LoadState, PageHeader, StatCard } from "@/components/Ui";
import { RideStatusBadge } from "@/features/rides/components/RideStatusBadge";
import { formatKm } from "@/lib/format";
import { formatDuration, stopsDone, useLiveCircuits } from "../api";

export function LiveCircuitsPage() {
  const { data, error, isPending } = useLiveCircuits();
  const [selected, setSelected] = useState<string | undefined>();
  const running = data?.filter((ride) => ride.status === "RIDE_STARTED") ?? [];
  const issues = data?.filter((ride) => ride.circuit.exception) ?? [];
  const pins = useMemo(
    () =>
      (data ?? [])
        .filter((ride) => ride.driverLocation)
        .map((ride) => ({
          id: ride.id,
          latitude: ride.driverLocation!.latitude,
          longitude: ride.driverLocation!.longitude,
          title: `${ride.rideCode} · ${ride.circuit.name}`,
          color: ride.circuit.exception ? "#dc2626" : ride.status === "RIDE_STARTED" ? "#eb6834" : "#2a78d6",
          faded: !ride.driverLocation!.fresh,
        })),
    [data],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Live circuits" subtitle="Every circuit that has not finished, refreshed every 5 seconds." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active" value={data?.length ?? "—"} />
        <StatCard label="In progress" value={running.length} tone="brand" />
        <StatCard label="Waiting for a driver" value={(data ?? []).filter((ride) => ride.status === "SEARCHING").length} tone="warn" />
        <StatCard label="Need attention" value={issues.length} tone={issues.length ? "bad" : "good"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <section className="h-[28rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <PinMap pins={pins} selectedId={selected} onSelect={setSelected} />
        </section>
        <section className="max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <LoadState pending={isPending} error={error} empty={data?.length === 0} emptyText="No circuits running right now">
            <ul className="divide-y divide-slate-100">
              {data?.map((ride) => (
                <li key={ride.id} className={selected === ride.id ? "bg-bhagwa-50" : ""}>
                  <button type="button" onClick={() => setSelected(ride.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/circuits/bookings/${ride.id}`} className="font-mono text-xs font-semibold text-bhagwa-600 hover:underline">
                        {ride.rideCode}
                      </Link>
                      <RideStatusBadge status={ride.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900">{ride.circuit.name}</p>
                    <p className="text-xs text-slate-500">
                      {ride.customer?.name ?? "—"} · {ride.driver?.name ?? "no driver yet"}
                    </p>
                    {ride.status === "RIDE_STARTED" && (
                      <p className="mt-1 text-xs tabular-nums text-slate-700">
                        {ride.circuit.currentStop ? `→ ${ride.circuit.currentStop.name}` : "All stops done"} · {stopsDone(ride.circuit)}/{ride.circuit.stops.length} ·{" "}
                        {formatDuration(ride.circuit.usage.elapsedSeconds)} · {formatKm(ride.circuit.usage.distanceMeters)}
                      </p>
                    )}
                    {ride.circuit.exception && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> Stop {ride.circuit.exception.stopOrder} blocked
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </LoadState>
        </section>
      </div>
    </div>
  );
}
