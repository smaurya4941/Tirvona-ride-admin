import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Loader2, Phone, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Field, Section, timeAgo } from "@/components/DetailUi";
import { formatDateTime, titleCase } from "@/lib/format";
import { OPEN_SOS_STATUSES, mapsLink, useSos, useUpdateSos } from "../api/sos";
import type { SosDetail, SosStatus } from "../api/sos";
import { LOCATION_SOURCE_LABEL, SosStatusBadge } from "../components/SosBadges";

/** OpenStreetMap's keyless embed, centred on the incident. */
function IncidentMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const delta = 0.01;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].map((n) => n.toFixed(5)).join(",");
  return (
    <iframe
      title="Incident location"
      className="h-72 w-full rounded-xl border border-slate-200"
      loading="lazy"
      referrerPolicy="no-referrer"
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(6)},${longitude.toFixed(6)}`}
    />
  );
}

const ACTIONS: Array<{ status: SosStatus; label: string; needsNote: boolean; style: string }> = [
  { status: "ACKNOWLEDGED", label: "Acknowledge", needsNote: false, style: "bg-red-600 text-white hover:bg-red-700" },
  { status: "IN_PROGRESS", label: "Mark in progress", needsNote: false, style: "bg-sky-600 text-white hover:bg-sky-700" },
  { status: "RESOLVED", label: "Resolve", needsNote: true, style: "bg-emerald-600 text-white hover:bg-emerald-700" },
  { status: "CANCELLED", label: "Close as false alarm", needsNote: true, style: "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50" },
];

/** Mirrors the server's forward-only lifecycle. */
const NEXT: Record<SosStatus, SosStatus[]> = {
  TRIGGERED: ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED", "CANCELLED"],
  RESOLVED: [],
  CANCELLED: [],
};

function Actions({ sos }: { sos: SosDetail }) {
  const update = useUpdateSos();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<SosStatus | null>(null);
  const available = ACTIONS.filter((action) => NEXT[sos.status].includes(action.status));
  if (!available.length) return null;

  async function run(status: SosStatus, needsNote: boolean) {
    if (needsNote && !note.trim()) {
      setPending(status);
      return;
    }
    await update.mutateAsync({ id: sos.id, status, note: note.trim() || undefined });
    setNote("");
    setPending(null);
  }

  return (
    <Section title="Respond" className={sos.status === "TRIGGERED" ? "ring-2 ring-red-500" : ""}>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">
          Note {pending ? <span className="text-red-600">(required to {pending === "RESOLVED" ? "resolve" : "close"})</span> : "(what was done — kept in the incident timeline)"}
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. Called the rider, driver instructed to stop at the nearest police post"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {available.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={update.isPending}
            onClick={() => void run(action.status, action.needsNote)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${action.style}`}
          >
            {update.isPending && update.variables?.status === action.status && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {action.label}
          </button>
        ))}
      </div>
      {update.error && <p className="mt-3 text-sm text-red-600">{update.error.message}</p>}
    </Section>
  );
}

function PersonCard({ title, person, extra }: { title: string; person: { name: string; phone: string } | null; extra?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      {person ? (
        <>
          <p className="mt-1 font-semibold text-slate-900">{person.name}</p>
          {extra && <p className="text-xs text-slate-500">{extra}</p>}
          <a href={`tel:${person.phone}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-bhagwa-600 hover:underline">
            <Phone className="h-3.5 w-3.5" aria-hidden /> {person.phone}
          </a>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-500">—</p>
      )}
    </div>
  );
}

export function SosDetailPage() {
  const { id = "" } = useParams();
  const { data: sos, error, isPending } = useSos(id);

  if (isPending)
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading incident…
      </p>
    );
  if (error || !sos)
    return (
      <p className="flex items-center gap-2 text-sm text-red-600">
        <XCircle className="h-4 w-4" aria-hidden /> {error?.message ?? "Incident not found"}
      </p>
    );

  const open = OPEN_SOS_STATUSES.includes(sos.status);
  const latest = sos.locationUpdates.at(-1) ?? sos.location;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/safety" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-bhagwa-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Safety & SOS
      </Link>

      <header className={`rounded-2xl p-5 ${sos.status === "TRIGGERED" ? "bg-red-600 text-white" : "border border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center gap-3">
          {open ? <AlertTriangle className="h-7 w-7" aria-hidden /> : <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />}
          <h1 className="text-2xl font-bold">SOS {sos.sosCode}</h1>
          <SosStatusBadge status={sos.status} />
        </div>
        <p className={`mt-2 text-sm ${sos.status === "TRIGGERED" ? "text-red-50" : "text-slate-600"}`}>
          Raised by the {sos.raisedByRole.toLowerCase()} {sos.raisedBy?.name} · {formatDateTime(sos.triggeredAt)} ({timeAgo(sos.triggeredAt)}) · ride{" "}
          <Link to={`/rides/${sos.rideId}`} className="font-mono underline">
            {sos.rideCode}
          </Link>
        </p>
        {sos.message && <p className="mt-2 rounded-lg bg-white/20 px-3 py-2 text-sm font-medium">“{sos.message}”</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Location"
            action={
              <a
                href={mapsLink(latest.latitude, latest.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-bhagwa-600 hover:underline"
              >
                Open in Google Maps <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            }
          >
            <IncidentMap latitude={latest.latitude} longitude={latest.longitude} />
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Coordinates" value={`${latest.latitude.toFixed(5)}, ${latest.longitude.toFixed(5)}`} mono />
              <Field label="Address" value={latest.address} />
              <Field label="Accuracy" value={latest.accuracyMeters ? `± ${Math.round(latest.accuracyMeters)} m` : undefined} />
              <Field label="Source" value={LOCATION_SOURCE_LABEL[latest.source]} />
              <Field label="Captured" value={formatDateTime(latest.capturedAt)} />
              <Field label="Updates" value={`${sos.locationUpdates.length} later position${sos.locationUpdates.length === 1 ? "" : "s"}`} />
            </dl>
            {sos.driverLocation && (
              <p className="mt-4 text-sm text-slate-600">
                Driver's live position:{" "}
                <a href={mapsLink(sos.driverLocation.latitude, sos.driverLocation.longitude)} target="_blank" rel="noopener noreferrer" className="font-medium text-bhagwa-600 hover:underline">
                  {sos.driverLocation.latitude.toFixed(5)}, {sos.driverLocation.longitude.toFixed(5)}
                </a>{" "}
                ({timeAgo(sos.driverLocation.updatedAt)})
              </p>
            )}
          </Section>

          <Section title="Ride">
            {sos.ride ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Ride" value={<Link to={`/rides/${sos.ride.id}`} className="font-mono text-bhagwa-600 hover:underline">{sos.ride.rideCode}</Link>} />
                <Field label="Status now" value={`${titleCase(sos.ride.status)} (was ${titleCase(sos.rideStatus)} at the alert)`} />
                <Field label="Pickup" value={sos.ride.pickup.address} />
                <Field label="Destination" value={sos.ride.destination.address} />
                <Field
                  label="Vehicle"
                  value={sos.ride.vehicle ? `${titleCase(sos.ride.vehicle.vehicleType)} · ${sos.ride.vehicle.registrationNumber}${[sos.ride.vehicle.color, sos.ride.vehicle.make, sos.ride.vehicle.model].filter(Boolean).length ? ` (${[sos.ride.vehicle.color, sos.ride.vehicle.make, sos.ride.vehicle.model].filter(Boolean).join(" ")})` : ""}` : undefined}
                  mono
                />
                <Field label="Trip started" value={formatDateTime(sos.ride.startedAt)} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Ride not found.</p>
            )}
          </Section>

          <Section title="Timeline">
            <ol className="space-y-3">
              {sos.timeline.map((entry, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-bhagwa-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {titleCase(entry.status)} <span className="font-normal text-slate-500">· {formatDateTime(entry.at)}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.by ?? titleCase(entry.byRole)} ({titleCase(entry.byRole)})
                    </p>
                    {entry.note && <p className="mt-1 text-sm text-slate-700">{entry.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
            {sos.resolutionNote && (
              <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <strong>Outcome:</strong> {sos.resolutionNote}
              </p>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Actions sos={sos} />

          <Section title="People">
            <div className="space-y-3">
              <PersonCard title="Customer" person={sos.customer} />
              <PersonCard title="Driver" person={sos.driver} extra={sos.driver ? `${sos.driver.driverCode} · ${sos.vehiclePlate ?? ""}` : undefined} />
            </div>
          </Section>

          <Section title={`Emergency contacts of the ${sos.raisedByRole.toLowerCase()}`}>
            {sos.emergencyContacts.length === 0 ? (
              <p className="text-sm text-slate-500">None saved.</p>
            ) : (
              <ul className="space-y-3">
                {sos.emergencyContacts.map((contact) => (
                  <li key={contact.phone} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {contact.name}
                        {contact.isPrimary && <span className="ml-2 rounded bg-bhagwa-100 px-1.5 py-0.5 text-[10px] font-semibold text-bhagwa-600">PRIMARY</span>}
                      </p>
                      <p className="text-xs text-slate-500">{contact.relationship ?? "—"}</p>
                    </div>
                    <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 text-sm font-medium text-bhagwa-600 hover:underline">
                      <Phone className="h-3.5 w-3.5" aria-hidden /> {contact.phone}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-slate-500">
              Contacts are not messaged automatically (no SMS/WhatsApp integration yet) — call them if needed.
            </p>
          </Section>

          <Section title="Handling">
            <dl className="grid gap-3">
              <Field label="Handled by" value={sos.handledBy?.name} />
              <Field label="Acknowledged" value={formatDateTime(sos.acknowledgedAt)} />
              <Field label="In progress" value={formatDateTime(sos.inProgressAt)} />
              <Field label="Resolved" value={formatDateTime(sos.resolvedAt ?? sos.cancelledAt)} />
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
