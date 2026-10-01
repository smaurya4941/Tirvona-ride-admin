import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Bike, Car, CheckCircle2, Loader2, Save, Truck, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { RideTypeCode } from "@/features/rides/api/rides";
import { Link } from "react-router-dom";
import { previewFare, usePricing, useUpdatePricing } from "../api/pricing";
import type { PricingRates, PricingRow } from "../api/pricing";

const ICONS: Record<string, LucideIcon> = { bike: Bike, auto: Truck, e_rickshaw: Truck, cab: Car, cab_xl: Car, premium: Car };

const FIELDS: Array<{ key: keyof PricingRates; label: string; hint: string; max: number }> = [
  { key: "baseFare", label: "Base fare", hint: "Charged on every ride", max: 5_000 },
  { key: "perKmRate", label: "Per km", hint: "× trip distance", max: 500 },
  { key: "perMinuteRate", label: "Per minute", hint: "× estimated trip time", max: 100 },
  { key: "minimumFare", label: "Minimum fare", hint: "Floor for short trips", max: 10_000 },
];

type Draft = Record<keyof PricingRates, string>;

const toDraft = (rates: PricingRates): Draft => ({
  baseFare: String(rates.baseFare),
  perKmRate: String(rates.perKmRate),
  perMinuteRate: String(rates.perMinuteRate),
  minimumFare: String(rates.minimumFare),
});

/** Same rules the API enforces: 0 ≤ value ≤ max, at most 2 decimals. */
function validate(draft: Draft): { rates: PricingRates | null; errors: Partial<Record<keyof PricingRates, string>> } {
  const errors: Partial<Record<keyof PricingRates, string>> = {};
  const rates = {} as PricingRates;
  for (const { key, max } of FIELDS) {
    const raw = draft[key].trim();
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) errors[key] = "Enter an amount";
    else if (value < 0) errors[key] = "Cannot be negative";
    else if (value > max) errors[key] = `At most ${formatMoney(max)}`;
    else if (!/^\d+(\.\d{1,2})?$/.test(raw)) errors[key] = "Up to 2 decimals";
    else rates[key] = value;
  }
  return { rates: Object.keys(errors).length ? null : rates, errors };
}

function PricingEditor({ row }: { row: PricingRow }) {
  const pricing = row.pricing;
  const update = useUpdatePricing();
  const [draft, setDraft] = useState<Draft | null>(pricing ? toDraft(pricing) : null);
  const [preview, setPreview] = useState({ km: "5", minutes: "15" });
  // The parent keys this component by ride type, so switching tabs remounts
  // it with a fresh draft. After a save the refetched tariff equals the
  // draft, which makes the form clean again.
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  const { rates, errors } = useMemo(() => (draft ? validate(draft) : { rates: null, errors: {} }), [draft]);
  const changed = useMemo(() => {
    if (!pricing || !rates) return {};
    return Object.fromEntries(FIELDS.filter(({ key }) => rates[key] !== pricing[key]).map(({ key }) => [key, rates[key]]));
  }, [pricing, rates]);
  const dirty = Object.keys(changed).length > 0;
  const sample = rates ? previewFare(rates, Number(preview.km) || 0, Number(preview.minutes) || 0) : null;
  const Icon = ICONS[row.rideType.icon] ?? Car;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    update.mutate(
      { rideType: row.rideType.code, rates: changed },
      { onSuccess: (saved) => setSavedVersion(saved.version) },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bhagwa-100 text-bhagwa-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-midnight">{row.rideType.displayName}</h2>
              <p className="text-sm text-slate-500">{row.rideType.description}</p>
            </div>
          </div>
          <Link to="/ride-types" className="flex items-center gap-2 text-sm" title="Activate or switch off on the Ride types page">
            <span className={`h-2 w-2 rounded-full ${row.rideType.isActive ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden />
            <span className={row.rideType.isActive ? "text-emerald-700" : "text-slate-500"}>{row.rideType.isActive ? "Bookable" : "Switched off"}</span>
          </Link>
        </header>

        {!pricing || !draft ? (
          <p className="text-sm text-red-600">
            No tariff yet. <Link to="/ride-types" className="font-semibold underline">Set it on the Ride types page</Link>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              {FIELDS.map(({ key, label, hint }) => (
                <label key={key} className="block">
                  <span className="text-sm font-medium text-slate-800">{label}</span>
                  <span className="relative mt-1 block">
                    <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-500">₹</span>
                    <input
                      inputMode="decimal"
                      value={draft[key]}
                      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                      aria-invalid={Boolean(errors[key])}
                      className={`w-full rounded-lg border py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-1 ${
                        errors[key]
                          ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                          : "border-slate-300 focus:border-bhagwa-500 focus:ring-bhagwa-500"
                      }`}
                    />
                  </span>
                  <span className={`mt-1 block text-xs ${errors[key] ? "text-red-600" : "text-slate-500"}`}>
                    {errors[key] ?? hint}
                  </span>
                </label>
              ))}
            </div>

            {update.error && (
              <p className="mt-5 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{update.error.message}</p>
            )}
            {savedVersion !== null && !dirty && (
              <p className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Saved as version {savedVersion}. New estimates use it
                immediately; booked rides keep their original tariff.
              </p>
            )}

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-500">
                Version {pricing.version} · updated {formatDateTime(pricing.updatedAt)}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={!dirty || update.isPending}
                  onClick={() => setDraft(toDraft(pricing))}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={!dirty || !rates || update.isPending}
                  className="flex items-center gap-2 rounded-lg bg-bhagwa-500 px-4 py-2 text-sm font-semibold text-white hover:bg-bhagwa-600 disabled:opacity-50"
                >
                  {update.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden />
                  )}
                  Save changes
                </button>
              </div>
            </footer>
          </form>
        )}
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-midnight">Fare preview</h3>
        <p className="mt-1 text-xs text-slate-500">Uses the values in the form, saved or not.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600">Distance (km)</span>
            <input
              inputMode="decimal"
              value={preview.km}
              onChange={(event) => setPreview({ ...preview, km: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Time (min)</span>
            <input
              inputMode="decimal"
              value={preview.minutes}
              onChange={(event) => setPreview({ ...preview, minutes: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        {sample && rates ? (
          <dl className="mt-5 space-y-1.5 text-sm">
            {[
              ["Base fare", formatMoney(rates.baseFare)],
              ["Distance charge", formatMoney(sample.distanceCharge)],
              ["Time charge", formatMoney(sample.timeCharge)],
              ["Subtotal", formatMoney(sample.subtotal)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-slate-700">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
              <dt>Customer pays</dt>
              <dd>{formatMoney(sample.total)}</dd>
            </div>
            {sample.minimumApplied && <p className="text-xs text-amber-700">Minimum fare applied.</p>}
          </dl>
        ) : (
          <p className="mt-5 text-sm text-slate-500">Fix the highlighted fields to see a preview.</p>
        )}
      </aside>
    </div>
  );
}

export function PricingPage() {
  const { data, error, isPending } = usePricing();
  const [selected, setSelected] = useState<RideTypeCode | null>(null);
  const current = data?.find((row) => row.rideType.code === selected) ?? data?.[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-midnight">Pricing</h1>
        <p className="text-sm text-slate-500">Tariffs per ride type. Fares are always calculated by the server.</p>
      </header>

      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading pricing…
        </p>
      ) : error ? (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" aria-hidden /> {error.message}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ride type">
            {data.map(({ rideType }) => {
              const active = rideType.code === current?.rideType.code;
              return (
                <button
                  key={rideType.code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelected(rideType.code)}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
                    active ? "bg-bhagwa-500 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {rideType.displayName}
                  {!rideType.isActive && (
                    <span className={`text-[10px] uppercase ${active ? "text-white/80" : "text-slate-400"}`}>off</span>
                  )}
                </button>
              );
            })}
          </div>
          {current && <PricingEditor key={current.rideType.code} row={current} />}
        </>
      )}
    </div>
  );
}
