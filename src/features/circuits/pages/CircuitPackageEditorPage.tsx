import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Circle,
  ImageOff,
  ImageUp,
  Loader2,
  MapPin,
  Replace,
  Route,
  Search,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Section } from "@/components/DetailUi";
import { PinMap } from "@/components/GoogleMap";
import { Button, ConfirmDialog, FormField, LoadState, Notice, PageHeader, Pill, inputClass } from "@/components/Ui";
import { useAuditLog, useRideTypes } from "@/features/platform/api";
import { checkPlacePhoto } from "@/features/places/api";
import { formatDateTime, formatKm, formatMinutes, formatMoney, titleCase } from "@/lib/format";
import {
  NEXT_STATUSES,
  WEEKDAYS,
  circuitCoverUrl,
  formatDuration,
  resolvePlace,
  searchPlaces,
  useCircuitPackage,
  useCreateCircuitPackage,
  useDeleteCircuitPackage,
  useRemoveCircuitCover,
  useRoutePreview,
  useSetCircuitPackageStatus,
  useUpdateCircuitPackage,
  useUploadCircuitCover,
} from "../api";
import type { CircuitPackage, PackageInput, PackageStatus, PlaceSuggestion, RoutePreview } from "../api";
import { PACKAGE_STATUS_TONE } from "./CircuitPackagesPage";

const COVER_RULE = { maxBytes: 1024 * 1024, minWidth: 320, minHeight: 200, minAspect: 0.4, maxAspect: 1.1, hint: "Landscape PNG, JPEG or WEBP, at least 320 × 200 px (800 × 500 recommended), up to 1 MB" };

const STEPS = ["Basics", "Stops", "Route preview", "Pricing", "Vehicles & passengers", "Availability"] as const;
type Step = (typeof STEPS)[number];

interface StopDraft {
  placeId: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

interface FormState {
  name: string;
  description: string;
  city: string;
  cancellationPolicy: string;
  stops: StopDraft[];
  basePrice: string;
  includedDistanceKm: string;
  includedDurationHours: string;
  extraDistanceRatePerKm: string;
  extraDurationRatePerHour: string;
  rideTypes: string[];
  maxPassengers: string;
  days: number[];
  opensAt: string;
  closesAt: string;
  validFrom: string;
  validUntil: string;
  originLabel: string;
  originLatitude: string;
  originLongitude: string;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  city: "",
  cancellationPolicy: "Free cancellation before a driver is assigned. After that, a cancellation fee may apply. A started circuit cannot be cancelled.",
  stops: [],
  basePrice: "",
  includedDistanceKm: "",
  includedDurationHours: "",
  extraDistanceRatePerKm: "",
  extraDurationRatePerHour: "",
  rideTypes: [],
  maxPassengers: "4",
  days: [0, 1, 2, 3, 4, 5, 6],
  opensAt: "06:00",
  closesAt: "20:00",
  validFrom: "",
  validUntil: "",
  originLabel: "",
  originLatitude: "",
  originLongitude: "",
};

function fromPackage(pkg: CircuitPackage): FormState {
  return {
    name: pkg.name,
    description: pkg.description,
    city: pkg.city,
    cancellationPolicy: pkg.cancellationPolicy ?? "",
    stops: pkg.stops.map((stop) => ({ placeId: stop.placeId, name: stop.name, address: stop.address, latitude: stop.latitude, longitude: stop.longitude })),
    basePrice: pkg.pricing ? String(pkg.pricing.basePrice) : "",
    includedDistanceKm: pkg.pricing ? String(pkg.pricing.includedDistanceKm) : "",
    includedDurationHours: pkg.pricing ? String(pkg.pricing.includedDurationHours) : "",
    extraDistanceRatePerKm: pkg.pricing ? String(pkg.pricing.extraDistanceRatePerKm) : "",
    extraDurationRatePerHour: pkg.pricing ? String(pkg.pricing.extraDurationRatePerHour) : "",
    rideTypes: pkg.rideTypes,
    maxPassengers: String(pkg.maxPassengers),
    days: pkg.availability.days,
    opensAt: pkg.availability.opensAt,
    closesAt: pkg.availability.closesAt,
    validFrom: pkg.availability.validFrom ?? "",
    validUntil: pkg.availability.validUntil ?? "",
    originLabel: pkg.referenceOrigin?.label ?? "",
    originLatitude: pkg.referenceOrigin ? String(pkg.referenceOrigin.latitude) : "",
    originLongitude: pkg.referenceOrigin ? String(pkg.referenceOrigin.longitude) : "",
  };
}

/** The form as the API wants it; returns a message for what is malformed (completeness is the server's call). */
function toInput(form: FormState, original?: CircuitPackage): { input?: PackageInput; error?: string } {
  if (form.name.trim().length < 3) return { error: "Enter the package name (at least 3 characters)" };
  if (form.city.trim().length < 2) return { error: "Enter the city" };
  const input: PackageInput = {
    name: form.name.trim(),
    description: form.description.trim(),
    city: form.city.trim(),
    cancellationPolicy: form.cancellationPolicy.trim(),
    stops: form.stops.map((stop) => ({ placeId: stop.placeId, name: stop.name.trim() || undefined })),
    rideTypes: form.rideTypes,
  };

  const priceFields = [form.basePrice, form.includedDistanceKm, form.includedDurationHours, form.extraDistanceRatePerKm, form.extraDurationRatePerHour];
  if (priceFields.some((value) => value.trim() !== "")) {
    const numbers = priceFields.map(Number);
    if (priceFields.some((value) => value.trim() === "") || numbers.some((value) => !Number.isFinite(value) || value < 0))
      return { error: "Pricing: fill in all five numbers (0 or more)" };
    const [basePrice, includedDistanceKm, includedDurationHours, extraDistanceRatePerKm, extraDurationRatePerHour] = numbers;
    input.pricing = { basePrice, includedDistanceKm, includedDurationHours, extraDistanceRatePerKm, extraDurationRatePerHour };
  }

  const passengers = Number(form.maxPassengers);
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 8) return { error: "Passenger limit: a whole number from 1 to 8" };
  input.maxPassengers = passengers;

  input.availability = {
    days: form.days,
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    validFrom: form.validFrom || (original?.availability.validFrom ? null : undefined),
    validUntil: form.validUntil || (original?.availability.validUntil ? null : undefined),
  };

  if (form.originLabel.trim() || form.originLatitude.trim() || form.originLongitude.trim()) {
    const latitude = Number(form.originLatitude);
    const longitude = Number(form.originLongitude);
    if (form.originLabel.trim().length < 2 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
      return { error: "Reference origin: a name plus valid latitude and longitude, or leave all three empty" };
    input.referenceOrigin = { label: form.originLabel.trim(), latitude, longitude };
  }
  return { input };
}

// ── Stop picker ────────────────────────────────────────────────────────

function PlaceSearch({ onPick, autoFocus }: { onPick: (stop: StopDraft) => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One Google billing session per search-and-pick.
  const session = useRef(crypto.randomUUID());

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true);
      searchPlaces(q, session.current)
        .then((result) => {
          if (!active) return;
          setResults(result.suggestions);
          setDegraded(result.degraded);
          setError(null);
        })
        .catch((reason: Error) => active && setError(reason.message))
        .finally(() => active && setBusy(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  async function pick(suggestion: PlaceSuggestion) {
    setBusy(true);
    try {
      const place = await resolvePlace(suggestion.id, session.current);
      onPick({ placeId: suggestion.id, name: suggestion.name, address: place.address, latitude: place.latitude, longitude: place.longitude });
      setQuery("");
      setResults([]);
      session.current = crypto.randomUUID();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">Search a place</span>
        <Search className="pointer-events-none absolute left-3 top-2 h-4 w-4 text-slate-400" aria-hidden />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a temple, ghat or landmark…"
          className={`${inputClass} pl-9`}
          maxLength={100}
        />
        {busy && <Loader2 className="absolute right-3 top-2 h-4 w-4 animate-spin text-slate-400" aria-hidden />}
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {degraded && <p className="mt-1 text-xs text-amber-700">The maps search is unavailable; only curated places are shown.</p>}
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg" role="listbox">
          {results.map((suggestion) => (
            <li key={suggestion.id}>
              <button type="button" onClick={() => void pick(suggestion)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-bhagwa-500" aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{suggestion.name}</span>
                  <span className="block text-xs text-slate-500">{suggestion.secondaryText}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StopsStep({ stops, onChange }: { stops: StopDraft[]; onChange: (stops: StopDraft[]) => void }) {
  const [replacing, setReplacing] = useState<number | null>(null);
  const move = (index: number, delta: number) => {
    const next = [...stops];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  const pins = stops
    .filter((stop) => stop.latitude !== undefined && stop.longitude !== undefined)
    .map((stop, index) => ({ id: stop.placeId, latitude: stop.latitude!, longitude: stop.longitude!, title: `${index + 1}. ${stop.name}`, color: "#eb6834" }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Pick each stop from the maps search, in visiting order. The server stores the provider place id and its exact coordinates; the customer’s pickup
          is not a stop.
        </p>
        <PlaceSearch onPick={(stop) => (stops.some((existing) => existing.placeId === stop.placeId) ? undefined : onChange([...stops, stop]))} />
        {stops.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">No stops yet. Add at least two.</p>
        ) : (
          <ol className="space-y-2">
            {stops.map((stop, index) => (
              <li key={stop.placeId} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bhagwa-500 text-xs font-bold text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <input
                      value={stop.name}
                      onChange={(event) => onChange(stops.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))}
                      className={`${inputClass} font-medium`}
                      aria-label={`Stop ${index + 1} display name`}
                      maxLength={120}
                    />
                    <p className="mt-1 truncate text-xs text-slate-500" title={stop.address}>
                      {stop.address}
                    </p>
                    {stop.latitude !== undefined && (
                      <a
                        href={`https://www.google.com/maps?q=${stop.latitude},${stop.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-slate-400 hover:underline"
                      >
                        {stop.latitude.toFixed(5)}, {stop.longitude!.toFixed(5)}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Move down" disabled={index === stops.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Replace" onClick={() => setReplacing(replacing === index ? null : index)}>
                      <Replace className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Remove" onClick={() => onChange(stops.filter((_, i) => i !== index))}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </IconButton>
                  </div>
                </div>
                {replacing === index && (
                  <div className="mt-3">
                    <PlaceSearch
                      autoFocus
                      onPick={(replacement) => {
                        onChange(stops.map((item, i) => (i === index ? replacement : item)));
                        setReplacing(null);
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="h-80 overflow-hidden rounded-xl border border-slate-200 lg:h-auto lg:min-h-[22rem]">
        <PinMap pins={pins} fitKey={pins.map((pin) => pin.id).join("|")} />
      </div>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
      {children}
    </button>
  );
}

// ── Route preview ──────────────────────────────────────────────────────

function RouteStep({ id, form }: { id?: string; form: FormState }) {
  const preview = useRoutePreview();
  const [result, setResult] = useState<RoutePreview | null>(null);
  if (!id) return <Notice tone="warning">Save the draft first; the route is calculated by the server from the saved package.</Notice>;
  const run = () =>
    preview.mutate(
      {
        id,
        stops: form.stops.map((stop) => ({ placeId: stop.placeId })),
        includedDistanceKm: form.includedDistanceKm.trim() ? Number(form.includedDistanceKm) : undefined,
      },
      { onSuccess: setResult },
    );
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The pickup is chosen by each customer, so the route here runs stop → stop. Add a reference origin (Availability step) to include a typical first leg.
      </p>
      <Button onClick={run} busy={preview.isPending} disabled={form.stops.length < 2}>
        <Route className="h-4 w-4" aria-hidden /> Calculate route
      </Button>
      {preview.error && <Notice tone="error">{preview.error.message}</Notice>}
      {result && (
        <div className="space-y-3">
          {result.warnings.map((warning) => (
            <Notice key={warning} tone="warning">
              {warning}
            </Notice>
          ))}
          <ol className="rounded-lg border border-slate-200 bg-white">
            <li className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-sm text-slate-500">
              <Circle className="h-3 w-3" aria-hidden /> Pickup (chosen by the customer)
              {result.originLeg && (
                <span className="ml-auto text-xs">
                  from reference origin: {formatKm(result.originLeg.distanceMeters)} · {formatMinutes(result.originLeg.durationSeconds)}
                </span>
              )}
            </li>
            {result.legs.map((leg) => (
              <li key={`${leg.from}-${leg.to}`} className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-sm last:border-0">
                <span className="text-slate-500">{leg.from}</span> → <span className="font-medium text-slate-900">{leg.to}</span>
                <span className="ml-auto tabular-nums text-slate-600">
                  {formatKm(leg.distanceMeters)} · {formatMinutes(leg.durationSeconds)}
                </span>
                {leg.provider !== "GOOGLE_ROUTES" && <Pill tone="amber">straight line</Pill>}
              </li>
            ))}
          </ol>
          <p className="text-sm text-slate-700">
            Stops route: <strong>{formatKm(result.stopsDistanceMeters)}</strong>, about <strong>{formatDuration(result.stopsDurationSeconds)}</strong> of driving
            (visit time comes on top).
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

export function CircuitPackageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: pkg, error, isPending } = useCircuitPackage(id);
  const rideTypes = useRideTypes();
  const create = useCreateCircuitPackage();
  const update = useUpdateCircuitPackage();
  const setStatus = useSetCircuitPackageStatus();
  const remove = useDeleteCircuitPackage();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState<Step>("Basics");
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "save" | "status" | "delete"; status?: PackageStatus } | null>(null);
  const loadedRevision = useRef<string | null>(null);

  // Load the package into the form once per version (not on every 15 s refetch).
  useEffect(() => {
    if (!pkg) return;
    const version = `${pkg.id}:${pkg.updatedAt}`;
    if (loadedRevision.current === version) return;
    loadedRevision.current = version;
    setForm(fromPackage(pkg));
  }, [pkg]);

  const live = pkg && pkg.status !== "DRAFT";
  const readOnly = pkg?.status === "ARCHIVED";
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const busy = create.isPending || update.isPending || setStatus.isPending;

  const selectedTypes = useMemo(
    () => (rideTypes.data ?? []).filter((row) => form.rideTypes.includes(row.rideType.code)).map((row) => row.rideType),
    [rideTypes.data, form.rideTypes],
  );

  async function save(reason?: string): Promise<CircuitPackage | undefined> {
    setProblem(null);
    setSaved(null);
    const { input, error: invalid } = toInput(form, pkg);
    if (!input) {
      setProblem(invalid ?? "Check the form");
      return undefined;
    }
    try {
      if (!pkg) {
        const created = await create.mutateAsync(input);
        navigate(`/circuits/packages/${created.id}`, { replace: true });
        setSaved("Draft saved");
        return created;
      }
      const updated = await update.mutateAsync({ id: pkg.id, ...input, reason });
      setSaved(pkg.status === "DRAFT" ? "Draft saved" : "Changes saved. Existing bookings keep the terms they were booked on.");
      return updated;
    } catch (reason) {
      setProblem((reason as Error).message);
      return undefined;
    }
  }

  async function publish() {
    const savedPackage = await save();
    if (!savedPackage) return;
    try {
      await setStatus.mutateAsync({ id: savedPackage.id, status: "ACTIVE", reason: "Published" });
      setSaved("Published. Customers can now book this circuit.");
    } catch (reason) {
      setProblem((reason as Error).message);
    }
  }

  if (id && (isPending || error))
    return (
      <div className="mx-auto max-w-6xl">
        <LoadState pending={isPending} error={error}>
          {null}
        </LoadState>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link to="/circuits/packages" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Circuit packages
      </Link>
      <PageHeader
        title={pkg ? pkg.name : "New circuit package"}
        subtitle={pkg ? `${pkg.code} · revision ${pkg.revision}${pkg.hasBookings ? " · has bookings" : ""}` : "Build it step by step; save a draft at any time."}
        actions={
          <>
            {pkg && <Pill tone={PACKAGE_STATUS_TONE[pkg.status]}>{titleCase(pkg.status)}</Pill>}
            {pkg?.status === "DRAFT" && !pkg.hasBookings && (
              <Button variant="ghost" onClick={() => setConfirm({ kind: "delete" })}>
                Delete draft
              </Button>
            )}
            {pkg &&
              NEXT_STATUSES[pkg.status]
                .filter((next) => !(pkg.status === "DRAFT" && next === "ACTIVE"))
                .map((next) => (
                  <Button key={next} variant={next === "ARCHIVED" ? "danger" : "secondary"} onClick={() => setConfirm({ kind: "status", status: next })}>
                    {next === "ACTIVE" ? "Activate" : next === "INACTIVE" ? "Deactivate" : "Archive"}
                  </Button>
                ))}
            {!readOnly && (
              <Button variant={pkg?.status === "DRAFT" || !pkg ? "secondary" : "primary"} busy={create.isPending || update.isPending} onClick={() => (live ? setConfirm({ kind: "save" }) : void save())}>
                {live ? "Save changes" : "Save draft"}
              </Button>
            )}
            {(!pkg || pkg.status === "DRAFT") && (
              <Button busy={setStatus.isPending} disabled={busy} onClick={() => void publish()}>
                Publish
              </Button>
            )}
          </>
        }
      />
      {problem && <Notice tone="error">{problem}</Notice>}
      {saved && <Notice tone="success">{saved}</Notice>}
      {readOnly && <Notice tone="warning">This package is archived. It stays for history and can no longer be changed or booked.</Notice>}

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <nav className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Steps">
            {STEPS.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => setStep(name)}
                aria-current={step === name ? "step" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium ${step === name ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === name ? "bg-white text-slate-900" : "bg-slate-200 text-slate-700"}`}>{index + 1}</span>
                {name}
              </button>
            ))}
          </nav>

          <fieldset disabled={readOnly} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {step === "Basics" && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Package name">
                  <input value={form.name} onChange={(event) => set("name", event.target.value)} className={inputClass} maxLength={100} placeholder="Vrindavan Spiritual Circuit" />
                </FormField>
                <FormField label="City">
                  <input value={form.city} onChange={(event) => set("city", event.target.value)} className={inputClass} maxLength={60} placeholder="Vrindavan" />
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="Description" hint="Shown on the package details screen">
                    <textarea rows={4} value={form.description} onChange={(event) => set("description", event.target.value)} className={inputClass} maxLength={1000} />
                  </FormField>
                </div>
                <div className="md:col-span-2">
                  <FormField label="Cancellation policy" hint="Shown to the customer before booking">
                    <textarea rows={3} value={form.cancellationPolicy} onChange={(event) => set("cancellationPolicy", event.target.value)} className={inputClass} maxLength={1000} />
                  </FormField>
                </div>
              </div>
            )}

            {step === "Stops" && <StopsStep stops={form.stops} onChange={(stops) => set("stops", stops)} />}

            {step === "Route preview" && <RouteStep id={pkg?.id} form={form} />}

            {step === "Pricing" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField label="Package price (₹)">
                    <input inputMode="decimal" value={form.basePrice} onChange={(event) => set("basePrice", event.target.value)} className={inputClass} placeholder="600" />
                  </FormField>
                  <FormField label="Included distance (km)">
                    <input inputMode="decimal" value={form.includedDistanceKm} onChange={(event) => set("includedDistanceKm", event.target.value)} className={inputClass} placeholder="30" />
                  </FormField>
                  <FormField label="Included duration (hours)">
                    <input inputMode="decimal" value={form.includedDurationHours} onChange={(event) => set("includedDurationHours", event.target.value)} className={inputClass} placeholder="5" />
                  </FormField>
                  <FormField label="Extra distance (₹ / km)" hint="Charged per started km">
                    <input inputMode="decimal" value={form.extraDistanceRatePerKm} onChange={(event) => set("extraDistanceRatePerKm", event.target.value)} className={inputClass} placeholder="15" />
                  </FormField>
                  <FormField label="Extra duration (₹ / hour)" hint="Charged per started 15 minutes">
                    <input inputMode="decimal" value={form.extraDurationRatePerHour} onChange={(event) => set("extraDurationRatePerHour", event.target.value)} className={inputClass} placeholder="50" />
                  </FormField>
                </div>
                <PricingExample form={form} />
                {live && <Notice tone="warning">Price changes apply to new bookings only. You will be asked for a reason, which is kept in the audit log.</Notice>}
              </div>
            )}

            {step === "Vehicles & passengers" && (
              <div className="space-y-4">
                <FormField label="Allowed vehicles" hint="Ride types customers can book this circuit with">
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {rideTypes.data?.map(({ rideType }) => (
                      <label key={rideType.code} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={form.rideTypes.includes(rideType.code)}
                          onChange={(event) => set("rideTypes", event.target.checked ? [...form.rideTypes, rideType.code] : form.rideTypes.filter((code) => code !== rideType.code))}
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-slate-900">{rideType.displayName}</span>
                          <span className="block text-xs text-slate-500">
                            {rideType.seatCapacity} seats{rideType.isActive ? "" : " · switched off"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </FormField>
                <div className="max-w-xs">
                  <FormField label="Passenger limit" hint="Capped by each vehicle's seats">
                    <input inputMode="numeric" value={form.maxPassengers} onChange={(event) => set("maxPassengers", event.target.value)} className={inputClass} />
                  </FormField>
                </div>
                {selectedTypes.some((type) => type.seatCapacity < Number(form.maxPassengers)) && (
                  <Notice tone="warning">
                    {selectedTypes
                      .filter((type) => type.seatCapacity < Number(form.maxPassengers))
                      .map((type) => `${type.displayName} seats ${type.seatCapacity}`)
                      .join(", ")}
                    : customers booking those vehicles are limited to their seats.
                  </Notice>
                )}
              </div>
            )}

            {step === "Availability" && (
              <div className="space-y-5">
                <FormField label="Operating days">
                  <div className="mt-1 flex flex-wrap gap-2">
                    {WEEKDAYS.map((day, index) => {
                      const on = form.days.includes(index);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set("days", on ? form.days.filter((value) => value !== index) : [...form.days, index].sort())}
                          className={`rounded-full px-3 py-1 text-[13px] font-medium ${on ? "bg-bhagwa-500 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </FormField>
                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField label="Opens at" hint="Bookable from">
                    <input type="time" value={form.opensAt} onChange={(event) => set("opensAt", event.target.value)} className={inputClass} />
                  </FormField>
                  <FormField label="Closes at" hint="Until (exclusive)">
                    <input type="time" value={form.closesAt} onChange={(event) => set("closesAt", event.target.value)} className={inputClass} />
                  </FormField>
                  <FormField label="Valid from" hint="Optional season start">
                    <input type="date" value={form.validFrom} onChange={(event) => set("validFrom", event.target.value)} className={inputClass} />
                  </FormField>
                  <FormField label="Valid until" hint="Optional season end">
                    <input type="date" value={form.validUntil} onChange={(event) => set("validUntil", event.target.value)} className={inputClass} />
                  </FormField>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-800">Reference origin (optional)</p>
                  <p className="mb-3 text-xs text-slate-500">Where pickups usually start, used only to judge viability in the route preview. Customers never see it.</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input value={form.originLabel} onChange={(event) => set("originLabel", event.target.value)} className={inputClass} placeholder="Vrindavan bus stand" aria-label="Origin name" />
                    <input inputMode="decimal" value={form.originLatitude} onChange={(event) => set("originLatitude", event.target.value)} className={inputClass} placeholder="Latitude" aria-label="Origin latitude" />
                    <input inputMode="decimal" value={form.originLongitude} onChange={(event) => set("originLongitude", event.target.value)} className={inputClass} placeholder="Longitude" aria-label="Origin longitude" />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
              <Button variant="ghost" disabled={step === STEPS[0]} onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>
                Back
              </Button>
              <Button variant="secondary" disabled={step === STEPS[STEPS.length - 1]} onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}>
                Next
              </Button>
            </div>
          </fieldset>
        </div>

        <aside className="space-y-4">
          <Section title="Publishing checklist">
            {!pkg ? (
              <p className="text-sm text-slate-500">Save the draft to see what is left before publishing.</p>
            ) : pkg.publishProblems.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Everything required is in place.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm text-amber-800">
                {pkg.publishProblems.map((item) => (
                  <li key={`${item.field}-${item.message}`} className="flex gap-2">
                    <Circle className="mt-1 h-3 w-3 shrink-0" aria-hidden /> {item.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-slate-400">Checked by the server from the saved package.</p>
          </Section>
          {pkg && <CoverCard pkg={pkg} />}
          {pkg && <HistoryCard id={pkg.id} />}
        </aside>
      </div>

      {confirm?.kind === "save" && (
        <ConfirmDialog
          title="Save changes to a live package?"
          body="New bookings use the new terms at once. Bookings already made keep the terms they were booked on."
          confirmLabel="Save changes"
          reasonLabel="Reason for the change"
          busy={update.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) => void save(reason).then((result) => result && setConfirm(null))}
        />
      )}
      {confirm?.kind === "status" && pkg && confirm.status && (
        <ConfirmDialog
          title={`${confirm.status === "ACTIVE" ? "Activate" : confirm.status === "INACTIVE" ? "Deactivate" : "Archive"} ${pkg.name}?`}
          body={
            confirm.status === "ARCHIVED"
              ? "Archived packages are no longer offered and cannot be edited again. Existing bookings are not affected."
              : confirm.status === "INACTIVE"
                ? "Customers stop seeing it at once. Circuits already booked continue normally."
                : "Customers can book it again (the server re-checks every publishing rule)."
          }
          confirmLabel={confirm.status === "ACTIVE" ? "Activate" : confirm.status === "INACTIVE" ? "Deactivate" : "Archive"}
          danger={confirm.status === "ARCHIVED"}
          reasonLabel="Reason"
          busy={setStatus.isPending}
          error={setStatus.error?.message}
          onCancel={() => {
            setStatus.reset();
            setConfirm(null);
          }}
          onConfirm={(reason) => setStatus.mutate({ id: pkg.id, status: confirm.status!, reason }, { onSuccess: () => setConfirm(null) })}
        />
      )}
      {confirm?.kind === "delete" && pkg && (
        <ConfirmDialog
          title={`Delete draft ${pkg.name}?`}
          body="The draft has never been booked and is removed permanently."
          confirmLabel="Delete"
          danger
          busy={remove.isPending}
          error={remove.error?.message}
          onCancel={() => setConfirm(null)}
          onConfirm={() => remove.mutate(pkg.id, { onSuccess: () => navigate("/circuits/packages") })}
        />
      )}
    </div>
  );
}

function PricingExample({ form }: { form: FormState }) {
  const price = Number(form.basePrice);
  const km = Number(form.includedDistanceKm);
  const hours = Number(form.includedDurationHours);
  const perKm = Number(form.extraDistanceRatePerKm);
  const perHour = Number(form.extraDurationRatePerHour);
  if (![price, km, hours, perKm, perHour].every((value) => Number.isFinite(value) && value > 0)) return null;
  const extraKm = 5;
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="font-medium text-slate-900">Example</p>
      <p className="mt-1">
        Within {km} km and {hours} h: <strong>{formatMoney(price)}</strong>. With {km + extraKm} km and {hours + 1} h:{" "}
        {formatMoney(price)} + {formatMoney(extraKm * perKm)} distance + {formatMoney(perHour)} time ={" "}
        <strong>{formatMoney(price + extraKm * perKm + perHour)}</strong>.
      </p>
    </div>
  );
}

function CoverCard({ pkg }: { pkg: CircuitPackage }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadCircuitCover();
  const remove = useRemoveCircuitCover();
  const [problem, setProblem] = useState<string | null>(null);
  const url = circuitCoverUrl(pkg);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    upload.reset();
    const check = await checkPlacePhoto(file, COVER_RULE);
    setProblem(check);
    if (!check) upload.mutate({ id: pkg.id, file });
  }

  return (
    <Section title="Cover image">
      <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {url ? <img src={url} alt={`${pkg.name} cover`} className="h-full w-full object-cover" /> : <Route className="h-8 w-8 text-slate-300" aria-hidden />}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void choose(event)} />
      <div className="mt-3 flex gap-3 text-sm">
        <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-1 font-semibold text-bhagwa-600 hover:underline" disabled={upload.isPending}>
          <ImageUp className="h-4 w-4" aria-hidden /> {upload.isPending ? "Uploading…" : url ? "Replace" : "Upload"}
        </button>
        {url && (
          <button type="button" onClick={() => remove.mutate(pkg.id)} className="flex items-center gap-1 text-slate-500 hover:underline" disabled={remove.isPending}>
            <ImageOff className="h-4 w-4" aria-hidden /> Remove
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{COVER_RULE.hint}</p>
      {(problem || upload.error || remove.error) && <p className="mt-1 text-xs text-red-600">{problem ?? upload.error?.message ?? remove.error?.message}</p>}
    </Section>
  );
}

function HistoryCard({ id }: { id: string }) {
  const { data } = useAuditLog({ page: 1, targetType: "CIRCUIT_PACKAGE", targetId: id });
  return (
    <Section title="Change history">
      {!data?.items.length ? (
        <p className="text-sm text-slate-500">No changes recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {data.items.slice(0, 12).map((entry) => {
            const changes = (entry.metadata?.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
            const status = entry.action === "circuit_package.status" ? (entry.metadata as { from?: string; to?: string }) : undefined;
            return (
              <li key={entry.id} className="border-l-2 border-slate-200 pl-3 text-xs">
                <p className="font-medium text-slate-800">
                  {titleCase(entry.action.replace("circuit_package.", ""))}
                  {status && ` · ${titleCase(status.from ?? "")} → ${titleCase(status.to ?? "")}`}
                </p>
                {Object.keys(changes).length > 0 && <p className="text-slate-600">Changed: {Object.keys(changes).map(titleCase).join(", ")}</p>}
                {changes.pricing && (
                  <p className="text-slate-600">
                    Price {formatMoney((changes.pricing.from as { basePrice?: number } | undefined)?.basePrice)} →{" "}
                    {formatMoney((changes.pricing.to as { basePrice?: number } | undefined)?.basePrice)}
                  </p>
                )}
                {entry.reason && <p className="italic text-slate-500">“{entry.reason}”</p>}
                <p className="text-slate-400">
                  {entry.adminName ?? "Admin"} · {formatDateTime(entry.createdAt)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
