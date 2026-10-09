import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { formatDateTime, formatKm, formatMinutes, formatMoney, titleCase } from "@/lib/format";
import { ADMIN_CANCELLABLE, useCancelRide, useCompleteRide, useRide } from "../api/rides";
import type { RideDetail, RideLocation } from "../api/rides";
import { CancelRideDialog } from "../components/CancelRideDialog";
import { CompleteRideDialog } from "../components/CompleteRideDialog";
import { COMPLETION_LABELS } from "../components/RideEndBadge";
import { RideStatusBadge } from "../components/RideStatusBadge";
import { RidePaymentBadge } from "@/features/payments/components/PaymentBadges";

function Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm p-5 ${className}`}>
      <h2 className="mb-4 text-base font-semibold text-midnight">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}

function Place({ label, place }: { label: string; place: RideLocation }) {
  const coordinates = `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`;
  return (
    <div className="flex gap-3">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-bhagwa-500" aria-hidden />
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900">{place.address}</p>
        <a
          href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-slate-500 hover:text-bhagwa-600 hover:underline"
        >
          {coordinates}
        </a>
      </div>
    </div>
  );
}

function FareRow({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** System reasons are CODES ("DRIVER_REJECTED: Too far"); free text stays as typed. */
function formatReason(reason?: string): string {
  if (!reason) return "—";
  const match = /^([A-Z_]+)(?::\s*(.*))?$/.exec(reason);
  if (!match) return reason;
  return match[2] ? `${titleCase(match[1])} — ${match[2]}` : titleCase(match[1]);
}

function Timeline({ ride }: { ride: RideDetail["ride"] }) {
  const steps: Array<[string, string | undefined]> = [
    ["Requested", ride.requestedAt],
    ["Assigned", ride.assignedAt],
    ["Accepted", ride.acceptedAt],
    ["Arrived", ride.arrivedAt],
    ["Started", ride.startedAt],
    ["Completed", ride.completedAt],
  ];
  if (ride.cancelledAt) steps.push(["Cancelled", ride.cancelledAt]);
  if (ride.expiredAt) steps.push(["No driver found", ride.expiredAt]);
  return (
    <ol className="space-y-2">
      {steps.map(([label, at]) => (
        <li key={label} className="flex items-center justify-between text-sm">
          <span className={`flex items-center gap-2 ${at ? "text-slate-900" : "text-slate-400"}`}>
            <span className={`h-2 w-2 rounded-full ${at ? "bg-bhagwa-500" : "bg-slate-300"}`} aria-hidden />
            {label}
          </span>
          <span className={at ? "text-slate-700" : "text-slate-400"}>{formatDateTime(at)}</span>
        </li>
      ))}
    </ol>
  );
}

export function RideDetailPage() {
  const { id = "" } = useParams();
  const { data, error, isPending } = useRide(id);
  const cancel = useCancelRide();
  const complete = useCompleteRide();
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading ride…
      </p>
    );
  }
  if (error) {
    return (
      <p className="flex items-center gap-2 text-sm text-red-600">
        <XCircle className="h-4 w-4" aria-hidden /> {error.message}
      </p>
    );
  }

  const { ride, customer, driver, history, checkpoints = [] } = data;
  const canCancel = ADMIN_CANCELLABLE.includes(ride.status);
  // A circuit ends through its own flow (admin → circuit bookings), not the end-of-trip OTP.
  const canComplete = ride.status === "RIDE_STARTED" && ride.kind !== "CIRCUIT";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link to="/rides" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All rides
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-midnight">{ride.rideCode}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <RideStatusBadge status={ride.status} />
            <span>{titleCase(ride.rideType)}</span>
            <span aria-hidden>·</span>
            <span className="font-mono text-xs">{ride.id}</span>
          </p>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={() => setCancelling(true)}
            className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            <Ban className="h-4 w-4" aria-hidden /> Cancel ride
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            onClick={() => setCompleting(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-midnight hover:bg-slate-50"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Complete ride
          </button>
        )}
      </header>

      {ride.end.needsReview && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">This trip needs a look</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {ride.end.mode && ride.end.mode !== "OTP" && ride.end.mode !== "NOT_REQUIRED" && (
                <li>
                  {COMPLETION_LABELS[ride.end.mode]}
                  {ride.end.note ? ` — “${ride.end.note}”` : ""}
                </li>
              )}
              {ride.end.farFromDestination && (
                <li>
                  The driver asked to end the trip {formatKm(ride.end.distanceToDestinationMeters)} from the booked drop-off.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {ride.cancellation && (
        <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Cancelled by {titleCase(ride.cancellation.cancelledBy)}</span>
            {ride.cancellation.reason ? ` — ${ride.cancellation.reason}` : ""}
            {data.cancellation && ` · while ${titleCase(data.cancellation.rideStatusAtCancellation).toLowerCase()}`}
          </p>
          {!!ride.cancellation.feeAmount && (
            <p className="mt-1">
              Cancellation fee {formatMoney(ride.cancellation.feeAmount)} · {titleCase(ride.cancellation.feeStatus ?? "DUE")}
              {data.cancellation?.policyVersion ? ` (policy v${data.cancellation.policyVersion})` : ""}{" "}
              <Link to="/cancellations?feeStatus=DUE" className="font-semibold text-bhagwa-600 hover:underline">
                Manage
              </Link>
            </p>
          )}
        </div>
      )}
      {ride.status === "NO_DRIVER_AVAILABLE" && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          No driver accepted within the search window ({ride.dispatchCount} offer
          {ride.dispatchCount === 1 ? "" : "s"} made).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Trip" className="lg:col-span-2">
          <div className="space-y-4">
            <Place label="Pickup" place={ride.pickup} />
            <Place label="Destination" place={ride.destination} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <Field label="Distance" value={formatKm(ride.distanceMeters)} />
            <Field label="Est. duration" value={formatMinutes(ride.durationSeconds)} />
            <Field label="Routing" value={titleCase(ride.routeProvider)} />
            <Field label="Driver → pickup" value={formatKm(ride.driverDistanceMeters)} />
            <Field label="Ride type" value={ride.rideType} />
            <Field label="Zone" value={ride.zone ? <Link to={`/zones/${ride.zone.id}`} className="text-bhagwa-600 hover:underline">{ride.zone.name}</Link> : "—"} />
          </dl>
        </Section>

        <Section title="Fare">
          <FareRow label="Base fare" value={formatMoney(ride.fare.baseFare)} />
          <FareRow
            label={`Distance (${formatMoney(ride.fare.perKmRate)}/km)`}
            value={formatMoney(ride.fare.distanceCharge)}
          />
          {ride.fare.peak && (
            <p className="-mt-1 mb-2 rounded-md bg-bhagwa-50 px-3 py-2 text-xs text-bhagwa-600">
              Peak pricing: {ride.fare.peak.name} (+{ride.fare.peak.hikePercent}% on per km,{" "}
              {formatMoney(ride.fare.basePerKmRate ?? ride.fare.perKmRate)} → {formatMoney(ride.fare.perKmRate)}/km), frozen when the ride was booked.
            </p>
          )}
          <FareRow
            label={`Time (${formatMoney(ride.fare.perMinuteRate)}/min)`}
            value={formatMoney(ride.fare.timeCharge)}
          />
          <FareRow label="Subtotal" value={formatMoney(ride.fare.subtotal)} />
          <FareRow
            label={`Minimum fare${ride.fare.minimumFareApplied ? " (applied)" : ""}`}
            value={formatMoney(ride.fare.minimumFare)}
          />
          <div className="mt-2 border-t border-slate-100 pt-2">
            <FareRow label="Estimated fare" value={formatMoney(ride.fare.estimatedFare)} strong />
            <FareRow label="Final fare" value={formatMoney(ride.fare.finalFare)} strong />
            {ride.promo && (
              <>
                <FareRow label={`Promo ${ride.promo.code}`} value={`− ${formatMoney(ride.fare.discount ?? ride.promo.discount)}`} />
                <FareRow label="Customer pays" value={formatMoney(ride.fare.payableFare)} strong />
              </>
            )}
          </div>
          {ride.promo && <p className="mt-1 text-xs text-slate-500">Discount funded by Tirvona; the driver earns on the full fare.</p>}
          <p className="mt-2 text-xs text-slate-500">Tariff version {ride.pricingVersion}</p>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-700">Payment</span>
            {ride.payment ? (
              <Link to={`/payments/${ride.payment.paymentId}`} className="hover:opacity-80">
                <RidePaymentBadge status={ride.paymentStatus} />
              </Link>
            ) : (
              <RidePaymentBadge status={ride.paymentStatus} />
            )}
          </div>
          {ride.payment?.gatewayPaymentId && (
            <p className="mt-1 text-right font-mono text-xs text-slate-500">{ride.payment.gatewayPaymentId}</p>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Customer">
          {customer ? (
            <dl className="space-y-3">
              <Field label="Name" value={customer.name} />
              <Field label="Phone" value={customer.phone} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Customer record not found.</p>
          )}
        </Section>

        <Section title="Driver">
          {driver ? (
            <dl className="space-y-3">
              <Field
                label="Name"
                value={
                  <Link to={`/drivers/${driver.driverId}`} className="text-bhagwa-600 hover:underline">
                    {driver.name}
                  </Link>
                }
              />
              <Field label="Phone" value={driver.phone} />
              <Field label="Driver code" value={<span className="font-mono">{driver.driverCode}</span>} />
              {ride.vehicle && (
                <Field
                  label="Vehicle"
                  value={
                    <>
                      <span className="font-mono">{ride.vehicle.registrationNumber}</span>
                      <span className="text-slate-500">
                        {" "}
                        · {[ride.vehicle.make, ride.vehicle.model, ride.vehicle.color].filter(Boolean).join(" ")}
                      </span>
                    </>
                  }
                />
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">No driver assigned.</p>
          )}
        </Section>

        <Section title="Timeline">
          <Timeline ride={ride} />
        </Section>
      </div>

      <Section title="Dispatch & OTP">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Offers made" value={ride.dispatchCount} />
          <Field label="Declined / timed out" value={ride.rejectedDriverCount} />
          <Field label="Search window ends" value={formatDateTime(ride.searchExpiresAt)} />
          <Field label="Offer expires" value={formatDateTime(ride.assignmentExpiresAt)} />
          <Field
            label="OTP"
            value={ride.otp.verifiedAt ? "Verified" : ride.otp.issued ? "Issued" : "Not issued"}
          />
          <Field label="Wrong OTP attempts" value={ride.otp.attempts} />
        </dl>
      </Section>

      <Section title="End of trip">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="End requested" value={formatDateTime(ride.end.requestedAt)} />
          <Field
            label="End code"
            value={
              ride.end.otpVerifiedAt
                ? "Verified"
                : ride.status === "RIDE_STARTED" && ride.end.requestedAt
                  ? "Waiting for the rider"
                  : "—"
            }
          />
          <Field label="Wrong code attempts" value={ride.end.requestedAt ? ride.end.otpAttempts : "—"} />
          <Field label="Ended by" value={ride.end.mode ? COMPLETION_LABELS[ride.end.mode] : "—"} />
          <Field
            label="Driver from drop-off"
            value={
              ride.end.distanceToDestinationMeters === undefined ? (
                "—"
              ) : (
                <span className={ride.end.farFromDestination ? "font-semibold text-amber-700" : undefined}>
                  {formatKm(ride.end.distanceToDestinationMeters)}
                </span>
              )
            }
          />
          <Field label="Completed" value={formatDateTime(ride.completedAt)} />
        </dl>
        {ride.end.note && <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-700">Note: {ride.end.note}</p>}
        <p className="mt-3 text-xs text-slate-500">The fare is priced up to the moment the driver asked to end the trip, not when the code was entered.</p>
      </Section>

      <Section title="Status history">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Transition</th>
                <th className="py-2 pr-4 font-medium">By</th>
                <th className="py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{formatDateTime(entry.createdAt)}</td>
                  <td className="py-2 pr-4">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {entry.fromStatus ? <RideStatusBadge status={entry.fromStatus} /> : <span className="text-slate-400">new</span>}
                      <span className="text-slate-400" aria-hidden>
                        →
                      </span>
                      <RideStatusBadge status={entry.toStatus} />
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-700">
                    {titleCase(entry.actorType)}
                    {entry.actorName && <span className="text-slate-500"> · {entry.actorName}</span>}
                  </td>
                  <td className="py-2 text-slate-600">{formatReason(entry.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Driver location checkpoints">
        {checkpoints.length === 0 ? (
          <p className="text-sm text-slate-500">No location checkpoints recorded for this ride.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Point</th>
                  <th className="py-2 pr-4 font-medium">Position</th>
                  <th className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checkpoints.map((point, index) => (
                  <tr key={`${point.kind}-${point.recordedAt}-${index}`}>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{formatDateTime(point.recordedAt)}</td>
                    <td className="py-2 pr-4 text-slate-800">{titleCase(point.kind)}</td>
                    <td className="py-2 pr-4">
                      <a
                        className="font-mono text-xs text-bhagwa-600 hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=17/${point.latitude}/${point.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                      </a>
                    </td>
                    <td className="py-2 text-slate-600">{point.source === "LIVE" ? "Live GPS" : "Last known"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {completing && (
        <CompleteRideDialog
          rideCode={ride.rideCode}
          endRequested={Boolean(ride.end.requestedAt)}
          isSubmitting={complete.isPending}
          error={complete.error?.message ?? null}
          onCancel={() => {
            complete.reset();
            setCompleting(false);
          }}
          onConfirm={(note) => complete.mutate({ id: ride.id, note }, { onSuccess: () => setCompleting(false) })}
        />
      )}

      {cancelling && (
        <CancelRideDialog
          rideCode={ride.rideCode}
          isSubmitting={cancel.isPending}
          error={cancel.error?.message ?? null}
          onCancel={() => {
            cancel.reset();
            setCancelling(false);
          }}
          onConfirm={(reason, reasonCode) => cancel.mutate({ id: ride.id, reason, reasonCode }, { onSuccess: () => setCancelling(false) })}
        />
      )}
    </div>
  );
}
