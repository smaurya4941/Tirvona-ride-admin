import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button, FormField, LoadState, Modal, Notice, PageHeader, Pill, Table, cell, inputClass } from "@/components/Ui";
import { formatDateTime } from "@/lib/format";
import {
  formatKilometers,
  formatMeters,
  parseBounded,
  usePlatformSettings,
  useRideDistanceConfigs,
  useUpdatePlatformSettings,
  useUpdateRideDistance,
} from "../api";
import type { DistanceBounds, PlatformSettingsResponse, RideDistanceRow } from "../api";

/** Input with its unit written next to it, so metres and kilometres cannot be mixed up. */
function UnitInput({ value, onChange, unit, label }: { value: string; onChange: (value: string) => void; unit: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <input aria-label={`${label} (${unit})`} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      <span className="w-14 shrink-0 text-sm font-medium text-slate-600">{unit}</span>
    </span>
  );
}

function DistanceForm({ row, bounds, onClose }: { row: RideDistanceRow; bounds: DistanceBounds; onClose: () => void }) {
  const update = useUpdateRideDistance();
  const [min, setMin] = useState(row.config ? String(row.config.minDistanceMeters) : "");
  const [max, setMax] = useState(row.config ? String(row.config.maxDistanceKm) : "");
  const [error, setError] = useState<string | null>(null);
  const name = row.rideType.displayName;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const minimum = parseBounded(min, "Minimum trip distance", bounds.minDistanceMeters, "meters", 0);
    if ("error" in minimum) return setError(minimum.error);
    const maximum = parseBounded(max, "Maximum trip distance", bounds.maxDistanceKm, "km", 3);
    if ("error" in maximum) return setError(maximum.error);
    if (minimum.value >= maximum.value * 1000) return setError("The minimum distance must be less than the maximum distance");
    update.mutate(
      { rideType: row.rideType.code, minDistanceMeters: minimum.value, maxDistanceKm: maximum.value },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal title={`${name} trip distance`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormField label="Minimum trip distance" hint="Shorter trips are refused. In meters.">
          <UnitInput label="Minimum trip distance" unit="meters" value={min} onChange={setMin} />
        </FormField>
        <FormField label="Maximum trip distance" hint="Longer trips are refused. In kilometers.">
          <UnitInput label="Maximum trip distance" unit="km" value={max} onChange={setMax} />
        </FormField>
        <p className="text-xs text-slate-500">
          Applies to the very next estimate and booking for {name}. Rides already booked keep the limits they were booked with. Other ride types are not affected.
        </p>
        {(error || update.error) && <Notice tone="error">{error ?? update.error?.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ConfigStatus({ row }: { row: RideDistanceRow }) {
  if (!row.config) return <Pill tone="red">Not configured</Pill>;
  if (!row.usable) return <Pill tone="red">Invalid values</Pill>;
  return row.rideType.isActive ? <Pill tone="green">Active</Pill> : <Pill>Ride type off</Pill>;
}

function TripDistanceSection() {
  const { data, error, isPending } = useRideDistanceConfigs();
  const [editing, setEditing] = useState<RideDistanceRow | null>(null);
  const broken = data?.items.filter((row) => row.rideType.isActive && !row.usable) ?? [];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Trip distance by ride type</h2>
        <p className="text-[13px] text-slate-500">How short and how long a trip can be, set separately for every ride type. Judged on the straight line between pickup and destination.</p>
      </div>
      {broken.length > 0 && (
        <Notice tone="error">
          {broken.map((row) => row.rideType.displayName).join(", ")} {broken.length === 1 ? "has" : "have"} no valid distance limits, so customers cannot get a quote or book until you set them.
        </Notice>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0}>
          <Table head={["Ride type", "Minimum trip distance", "Maximum trip distance", "Status", "Last updated", ""]}>
            {data?.items.map((row) => (
              <tr key={row.rideType.code} className={row.rideType.isActive ? "" : "bg-slate-50/60"}>
                <td className={cell}>
                  <Link to="/ride-types" className="font-semibold text-slate-900 hover:underline">
                    {row.rideType.displayName}
                  </Link>
                  <p className="font-mono text-xs text-slate-500">{row.rideType.code}</p>
                </td>
                <td className={`${cell} tabular-nums`}>{row.config ? formatMeters(row.config.minDistanceMeters) : "—"}</td>
                <td className={`${cell} tabular-nums`}>{row.config ? formatKilometers(row.config.maxDistanceKm) : "—"}</td>
                <td className={cell}>
                  <ConfigStatus row={row} />
                </td>
                <td className={cell}>
                  {row.config ? (
                    <>
                      {formatDateTime(row.config.updatedAt)}
                      <span className="block text-xs text-slate-400">v{row.config.version}{row.config.updatedBy ? "" : " · initial"}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`${cell} text-right`}>
                  <button type="button" onClick={() => setEditing(row)} className="font-semibold text-bhagwa-600 hover:underline">
                    {row.config ? "Edit" : "Set limits"}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        </LoadState>
      </div>
      {editing && data && <DistanceForm row={editing} bounds={data.limits} onClose={() => setEditing(null)} />}
    </section>
  );
}

function RadiiForm({ response }: { response: PlatformSettingsResponse }) {
  const update = useUpdatePlatformSettings();
  const { settings, limits } = response;
  const [matching, setMatching] = useState(settings ? String(settings.matchingRadiusKm) : "");
  const [nearby, setNearby] = useState(settings ? String(settings.nearbyDriversRadiusKm) : "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = !settings || matching.trim() !== String(settings.matchingRadiusKm) || nearby.trim() !== String(settings.nearbyDriversRadiusKm);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const parsedMatching = parseBounded(matching, "Matching radius", limits.matchingRadiusKm, "km", 3);
    if ("error" in parsedMatching) return setError(parsedMatching.error);
    const parsedNearby = parseBounded(nearby, "Nearby drivers radius", limits.nearbyDriversRadiusKm, "km", 3);
    if ("error" in parsedNearby) return setError(parsedNearby.error);
    update.mutate({ matchingRadiusKm: parsedMatching.value, nearbyDriversRadiusKm: parsedNearby.value }, { onSuccess: () => setSaved(true) });
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Matching radius" hint="How far from the pickup we look for a driver for a booked ride. Also drives the driver count and pickup time on a fare quote.">
          <UnitInput label="Matching radius" unit="km" value={matching} onChange={(value) => { setMatching(value); setSaved(false); }} />
        </FormField>
        <FormField label="Nearby drivers radius" hint="How far around the customer the Home map shows available cars. Display only — it does not limit booking.">
          <UnitInput label="Nearby drivers radius" unit="km" value={nearby} onChange={(value) => { setNearby(value); setSaved(false); }} />
        </FormField>
      </div>
      {(error || update.error) && (
        <div className="mt-4">
          <Notice tone="error">{error ?? update.error?.message}</Notice>
        </div>
      )}
      {saved && !dirty && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Saved. The next search and the next Home map refresh use these values.
        </p>
      )}
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          {settings ? `Version ${settings.version} · updated ${formatDateTime(settings.updatedAt)}` : "Not configured yet — set both values."}
        </p>
        <Button type="submit" disabled={!dirty} busy={update.isPending}>
          Save radii
        </Button>
      </footer>
    </form>
  );
}

function RadiiSection() {
  const { data, error, isPending } = usePlatformSettings();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Ride & matching configuration</h2>
        <p className="text-[13px] text-slate-500">Platform-wide settings, the same for every ride type.</p>
      </div>
      {data && !data.settings && (
        <Notice tone="error">Matching settings are missing, so driver matching and the Home map are failing. Enter both radii below.</Notice>
      )}
      <LoadState pending={isPending} error={error}>
        {data && <RadiiForm key={data.settings?.version ?? 0} response={data} />}
      </LoadState>
    </section>
  );
}

export function RideLimitsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader title="Ride limits" subtitle="Trip distance per ride type, and how far we search for drivers. Changes apply to the next request — no restart." />
      <TripDistanceSection />
      <RadiiSection />
    </div>
  );
}
