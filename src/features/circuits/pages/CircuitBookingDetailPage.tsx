import { useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, ArrowLeft, Phone } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Field, Section } from "@/components/DetailUi";
import { PinMap } from "@/components/GoogleMap";
import { Button, ConfirmDialog, FormField, LoadState, Modal, Notice, PageHeader, Pill, inputClass } from "@/components/Ui";
import { RideStatusBadge } from "@/features/rides/components/RideStatusBadge";
import { ADMIN_CANCELLABLE } from "@/features/rides/api/rides";
import { formatDateTime, formatKm, formatMoney, titleCase } from "@/lib/format";
import { formatDuration, useCancelCircuit, useCircuitBooking, useEndCircuit, useResolveCircuitException } from "../api";
import type { CircuitBookingDetail } from "../api";
import { CircuitUsage, StopTimeline } from "../components/CircuitBits";

const EVENT_LABEL: Record<string, string> = {
  BOOKED: "Booked",
  STOP_ARRIVED: "Arrived at stop",
  STOP_WAITING: "Customer visiting",
  STOP_COMPLETED: "Stop completed",
  STOP_BLOCKED: "Stop reported blocked",
  EXCEPTION_RESOLVED: "Issue resolved",
  WARNING: "Usage warning",
  ENDED_EARLY: "Ended early by support",
  COMPLETED: "Circuit completed",
  COMPLETED_BY_ADMIN: "Completed by support",
};

function ResolveDialog({ detail, onClose }: { detail: CircuitBookingDetail; onClose: () => void }) {
  const resolve = useResolveCircuitException();
  const [resolution, setResolution] = useState<"CONTINUE" | "SKIP_STOP">("CONTINUE");
  const [note, setNote] = useState("");
  const exception = detail.ride.circuit.exception!;
  const stop = detail.ride.circuit.stops.find((candidate) => candidate.order === exception.stopOrder);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (note.trim().length < 3) return;
    resolve.mutate({ id: detail.ride.id, resolution, note: note.trim() }, { onSuccess: onClose });
  }

  return (
    <Modal title={`Resolve: ${stop?.name ?? `stop ${exception.stopOrder}`} is blocked`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {exception.note && <Notice tone="warning">Driver says: {exception.note}</Notice>}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">What should happen?</legend>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input type="radio" checked={resolution === "CONTINUE"} onChange={() => setResolution("CONTINUE")} className="mt-1" />
            <span>
              <span className="block text-sm font-medium">Continue to this stop</span>
              <span className="block text-xs text-slate-500">The way is clear again; the driver carries on as normal.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input type="radio" checked={resolution === "SKIP_STOP"} onChange={() => setResolution("SKIP_STOP")} className="mt-1" />
            <span>
              <span className="block text-sm font-medium">Skip this stop</span>
              <span className="block text-xs text-slate-500">The stop is marked skipped and the next stop becomes current. The package price is unchanged.</span>
            </span>
          </label>
        </fieldset>
        <FormField label="Note" hint="Required — kept in the audit log">
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} maxLength={240} />
        </FormField>
        {resolve.error && <Notice tone="error">{resolve.error.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={resolve.isPending} disabled={note.trim().length < 3}>
            Resolve
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CircuitBookingDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, error, isPending } = useCircuitBooking(id);
  const end = useEndCircuit();
  const cancel = useCancelCircuit();
  const [dialog, setDialog] = useState<"resolve" | "end" | "cancel" | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link to="/circuits/bookings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Circuit bookings
      </Link>
      <LoadState pending={isPending} error={error}>
        {data && <Detail data={data} onAction={setDialog} />}
      </LoadState>

      {dialog === "resolve" && data && <ResolveDialog detail={data} onClose={() => setDialog(null)} />}
      {dialog === "end" && data && (
        <ConfirmDialog
          title="End this circuit now?"
          body="Unfinished stops are skipped and the circuit is billed for the time and distance used so far. The driver becomes free. This cannot be undone."
          confirmLabel="End circuit"
          danger
          reasonLabel="Reason"
          busy={end.isPending}
          error={end.error?.message}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => end.mutate({ id: data.ride.id, reason: reason! }, { onSuccess: () => setDialog(null) })}
        />
      )}
      {dialog === "cancel" && data && (
        <ConfirmDialog
          title="Cancel this circuit?"
          body="Only possible before it starts. No cancellation fee is charged when support cancels."
          confirmLabel="Cancel circuit"
          danger
          reasonLabel="Reason"
          busy={cancel.isPending}
          error={cancel.error?.message}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => cancel.mutate({ id: data.ride.id, reason: reason! }, { onSuccess: () => setDialog(null) })}
        />
      )}
    </div>
  );
}

function Detail({ data, onAction }: { data: CircuitBookingDetail; onAction: (action: "resolve" | "end" | "cancel") => void }) {
  const { ride, customer, driver } = data;
  const { circuit } = ride;
  const final = ride.fare.final;
  const lastFix = [...data.checkpoints].reverse()[0];
  const pins = [
    { id: "pickup", latitude: ride.pickup.latitude, longitude: ride.pickup.longitude, title: `Pickup: ${ride.pickup.address}`, color: "#0B192C" },
    ...circuit.stops.map((stop) => ({
      id: `stop-${stop.order}`,
      latitude: stop.latitude,
      longitude: stop.longitude,
      title: `${stop.order}. ${stop.name}`,
      color: stop.status === "COMPLETED" ? "#1baf7a" : stop.status === "SKIPPED" ? "#dc2626" : "#eb6834",
      faded: stop.status === "UPCOMING",
    })),
    ...(lastFix && ride.status === "RIDE_STARTED"
      ? [{ id: "driver", latitude: lastFix.latitude, longitude: lastFix.longitude, title: "Driver (last checkpoint)", color: "#2a78d6", heading: 0 }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={`${circuit.name} · ${ride.rideCode}`}
        subtitle={`${circuit.packageCode} · ${titleCase(ride.rideType)} · ${circuit.passengers} passenger${circuit.passengers === 1 ? "" : "s"} · booked ${formatDateTime(ride.requestedAt)}`}
        actions={
          <>
            <RideStatusBadge status={ride.status} />
            {circuit.exception && ride.status === "RIDE_STARTED" && (
              <Button onClick={() => onAction("resolve")}>
                <AlertTriangle className="h-4 w-4" aria-hidden /> Resolve issue
              </Button>
            )}
            {ride.status === "RIDE_STARTED" && (
              <Button variant="danger" onClick={() => onAction("end")}>
                End circuit
              </Button>
            )}
            {ADMIN_CANCELLABLE.includes(ride.status) && (
              <Button variant="danger" onClick={() => onAction("cancel")}>
                Cancel
              </Button>
            )}
          </>
        }
      />
      {circuit.exception && ride.status === "RIDE_STARTED" && (
        <Notice tone="error">
          Stop {circuit.exception.stopOrder} reported blocked {formatDateTime(circuit.exception.reportedAt)}
          {circuit.exception.note ? ` — “${circuit.exception.note}”` : ""}. The driver cannot continue until you resolve it.
        </Notice>
      )}
      {circuit.endedEarlyReason && <Notice tone="warning">Ended early by support: {circuit.endedEarlyReason}</Notice>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Route" className="lg:col-span-1">
          <StopTimeline circuit={circuit} pickup={ride.pickup.address} />
        </Section>
        <Section title="Map" className="lg:col-span-2">
          <div className="h-80 overflow-hidden rounded-lg">
            <PinMap pins={pins} fitKey={ride.id} />
          </div>
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Usage">
          {ride.startedAt ? (
            <>
              <CircuitUsage circuit={circuit} />
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Started" value={formatDateTime(ride.startedAt)} />
                <Field label={ride.completedAt ? "Completed" : "Elapsed"} value={ride.completedAt ? formatDateTime(ride.completedAt) : formatDuration(circuit.usage.elapsedSeconds)} />
                <Field label="Time left" value={ride.completedAt ? "—" : formatDuration(circuit.usage.remainingSeconds)} />
                <Field label="Distance left" value={ride.completedAt ? "—" : formatKm(Math.max(0, circuit.usage.remainingDistanceMeters))} />
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-500">The timer starts when the driver starts the circuit with the customer's PIN.</p>
          )}
        </Section>

        <Section title="Financial">
          <dl className="space-y-2 text-sm">
            <Row label="Package" value={formatMoney(circuit.pricing.basePrice)} />
            <Row
              label={`Extra distance${circuit.settlement ? ` (${circuit.settlement.extraKm} km × ${formatMoney(circuit.pricing.extraDistanceRatePerKm)})` : ""}`}
              value={formatMoney(final ? final.distanceCharge : circuit.projected.extraDistanceCharge)}
            />
            <Row
              label={`Extra time${circuit.settlement ? ` (${circuit.settlement.extraBlocks} × 15 min)` : ""}`}
              value={formatMoney(final ? final.timeCharge : circuit.projected.extraDurationCharge)}
            />
            <div className="border-t border-slate-100 pt-2">
              <Row label={final ? "Final" : "So far (projected)"} value={<strong>{formatMoney(final ? final.total : circuit.projected.total)}</strong>} />
            </div>
            <Row label="Payment" value={<Pill tone={ride.paymentStatus === "SUCCESS" ? "green" : ride.paymentStatus === "FAILED" || ride.paymentStatus === "PENDING" ? "amber" : "slate"}>{titleCase(ride.paymentStatus)}</Pill>} />
            {ride.payment?.paymentId && (
              <Link to={`/payments/${ride.payment.paymentId}`} className="text-xs font-semibold text-bhagwa-600 hover:underline">
                View payment
              </Link>
            )}
            {final && <p className="text-[11px] text-slate-400">Distance billed from the {final.distanceSource === "ACTUAL" ? "GPS trail" : "booked route (trail unreliable)"}.</p>}
          </dl>
        </Section>

        <Section title="People">
          <dl className="grid gap-3">
            <Field
              label="Customer"
              value={
                customer ? (
                  <Link to={`/customers/${customer.id}`} className="hover:underline">
                    {customer.name} · {customer.phone}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Field
              label="Driver"
              value={
                driver ? (
                  <span className="flex items-center gap-2">
                    <Link to={`/drivers/${driver.driverId}`} className="hover:underline">
                      {driver.name} ({driver.driverCode})
                    </Link>
                    <a href={`tel:${driver.phone}`} className="text-bhagwa-600" aria-label="Call driver">
                      <Phone className="h-4 w-4" />
                    </a>
                  </span>
                ) : (
                  "Not assigned"
                )
              }
            />
            <Field label="Vehicle" value={ride.vehicle ? `${titleCase(ride.vehicle.vehicleType)} · ${ride.vehicle.registrationNumber}` : "—"} />
            <Field label="Package revision" value={`${circuit.packageCode} r${ride.pricingVersion}`} />
          </dl>
        </Section>
      </div>

      <Section title="Timeline">
        <ol className="space-y-2">
          {[
            ...data.history.map((entry) => ({
              id: `h-${entry.id}`,
              at: entry.createdAt,
              title: titleCase(entry.toStatus),
              detail: [entry.actorName ?? titleCase(entry.actorType), entry.reason].filter(Boolean).join(" · "),
            })),
            ...data.timeline.map((entry) => {
              const stop = entry.stopOrder ? circuit.stops.find((candidate) => candidate.order === entry.stopOrder) : undefined;
              return {
                id: `c-${entry.id}`,
                at: entry.at,
                title: `${EVENT_LABEL[entry.type] ?? titleCase(entry.type)}${stop ? ` · ${stop.name}` : ""}${entry.data?.warning ? ` · ${titleCase(String(entry.data.warning))}` : ""}`,
                detail: [titleCase(entry.actorType), entry.note, entry.data?.locationVerified === false ? "no GPS fix" : undefined].filter(Boolean).join(" · "),
              };
            }),
          ]
            .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
            .map((entry) => (
              <li key={entry.id} className="flex gap-4 text-sm">
                <span className="w-36 shrink-0 tabular-nums text-xs text-slate-500">{formatDateTime(entry.at)}</span>
                <span>
                  <span className="font-medium text-slate-900">{entry.title}</span>
                  {entry.detail && <span className="block text-xs text-slate-500">{entry.detail}</span>}
                </span>
              </li>
            ))}
        </ol>
      </Section>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
