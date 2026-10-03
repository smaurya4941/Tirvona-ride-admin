import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink, Loader2, Phone } from "lucide-react";
import { Notice, PageHeader, Pill } from "@/components/Ui";
import { PinMap } from "@/components/GoogleMap";
import type { MapPin } from "@/components/GoogleMap";
import { LIVE_STATE_STYLE, ago, liveState, mapsLink, useLiveDrivers } from "../api/live";
import type { LiveDriver, LiveState } from "../api/live";

type Filter = "ALL" | Exclude<LiveState, "OFFLINE">;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "AVAILABLE", label: "Available" },
  { value: "ON_RIDE", label: "On a ride" },
  { value: "BUSY", label: "Busy" },
];

function pinFor(driver: LiveDriver): MapPin | undefined {
  if (!driver.location) return undefined;
  const style = LIVE_STATE_STYLE[liveState(driver)];
  return {
    id: driver.driverId,
    latitude: driver.location.latitude,
    longitude: driver.location.longitude,
    heading: driver.location.heading,
    title: `${driver.name} · ${driver.vehicle?.registrationNumber ?? driver.driverCode} · ${style.label}`,
    color: style.color,
    faded: !driver.location.fresh,
  };
}

/** Every online driver on one Google map, refreshed every few seconds. */
export function LiveMapPage() {
  const { data, error, isPending, dataUpdatedAt } = useLiveDrivers();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("ALL");
  const selectedId = params.get("driver") ?? undefined;
  const [now, setNow] = useState(Date.now());

  // Re-render the "x s ago" labels between refreshes.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const drivers = useMemo(
    () => (data?.items ?? []).filter((driver) => filter === "ALL" || liveState(driver) === filter),
    [data, filter],
  );
  const pins = useMemo(() => drivers.flatMap((driver) => pinFor(driver) ?? []), [drivers]);
  const selected = data?.items.find((driver) => driver.driverId === selectedId);
  const counts = useMemo(() => {
    const result: Record<Filter, number> = { ALL: 0, AVAILABLE: 0, ON_RIDE: 0, BUSY: 0 };
    for (const driver of data?.items ?? []) {
      result.ALL += 1;
      const state = liveState(driver);
      if (state !== "OFFLINE") result[state] += 1;
    }
    return result;
  }, [data]);

  const select = (id: string | undefined) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set("driver", id);
        else next.delete("driver");
        return next;
      },
      { replace: true },
    );

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col gap-4">
      <PageHeader
        title="Live map"
        subtitle="Online drivers and their latest positions. Updates every few seconds."
        actions={
          <span className="flex items-center gap-2 text-xs text-slate-500">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <span className="h-2 w-2 rounded-full bg-emerald-500" />}
            {dataUpdatedAt ? `Updated ${ago(new Date(dataUpdatedAt).toISOString(), now)}` : "Loading…"}
          </span>
        }
      />
      {error && <Notice tone="error">{error.message}</Notice>}
      {data?.truncated && <Notice tone="warning">Showing the {data.items.length} most recently seen drivers; more are online.</Notice>}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_1fr]">
        <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-3">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  filter === item.value ? "bg-midnight text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label} · {counts[item.value]}
              </button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {drivers.length === 0 && (
              <li className="p-6 text-center text-sm text-slate-500">{isPending ? "Loading…" : "No drivers online right now."}</li>
            )}
            {drivers.map((driver) => {
              const style = LIVE_STATE_STYLE[liveState(driver)];
              return (
                <li key={driver.driverId}>
                  <button
                    type="button"
                    onClick={() => select(driver.driverId === selectedId ? undefined : driver.driverId)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${driver.driverId === selectedId ? "bg-bhagwa-50" : ""}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{driver.name || driver.driverCode}</span>
                      <Pill tone={style.tone}>{style.label}</Pill>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-mono">{driver.vehicle?.registrationNumber ?? driver.driverCode}</span>
                      <span className={driver.location?.fresh === false ? "text-amber-600" : ""}>
                        {driver.location ? ago(driver.location.updatedAt, now) : "no location yet"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <PinMap pins={pins} selectedId={selectedId} onSelect={select} fitKey={filter} />
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:right-auto sm:w-80">
              <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                <span className="font-mono">{selected.driverCode}</span>
                {selected.vehicle && ` · ${selected.vehicle.vehicleType} ${selected.vehicle.registrationNumber}`}
              </p>
              {selected.ride && (
                <p className="mt-2 text-xs text-slate-600">
                  Ride{" "}
                  <Link className="font-semibold text-bhagwa-600 hover:underline" to={`/rides/${selected.ride.rideId}`}>
                    {selected.ride.rideCode}
                  </Link>{" "}
                  · {selected.ride.status.replaceAll("_", " ").toLowerCase()}
                </p>
              )}
              {selected.location ? (
                <p className="mt-2 text-xs text-slate-500">
                  Last seen {ago(selected.location.updatedAt, now)}
                  {selected.location.speed !== undefined && selected.location.source === "live"
                    ? ` · ${Math.round(selected.location.speed * 3.6)} km/h`
                    : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-600">This driver has not shared a position yet.</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
                <Link className="text-bhagwa-600 hover:underline" to={`/drivers/${selected.driverId}`}>
                  Driver details
                </Link>
                {selected.phone && (
                  <a className="inline-flex items-center gap-1 text-bhagwa-600 hover:underline" href={`tel:${selected.phone}`}>
                    <Phone className="h-3 w-3" aria-hidden /> {selected.phone}
                  </a>
                )}
                {selected.location && (
                  <a
                    className="inline-flex items-center gap-1 text-bhagwa-600 hover:underline"
                    href={mapsLink(selected.location.latitude, selected.location.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Maps <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
