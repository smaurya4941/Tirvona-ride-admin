import { useState } from "react";
import { ArrowLeft, Loader2, Phone, UserCheck, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Field, Section } from "@/components/DetailUi";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { COMPLAINT_NEXT, COMPLAINT_PRIORITIES, useComplaint, useUpdateComplaint } from "../api/complaints";
import type { ComplaintDetail, ComplaintPriority, ComplaintStatus } from "../api/complaints";
import { ComplaintStatusBadge, PriorityBadge } from "../components/ComplaintBadges";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500";

const ACTION_LABEL: Record<ComplaintStatus, string> = {
  OPEN: "Reopen",
  IN_REVIEW: "Start review",
  RESOLVED: "Resolve",
  CLOSED: "Close",
};

function historyLabel(action: string, status?: ComplaintStatus): string {
  if (action === "CREATED") return "Reported";
  if (action === "STATUS" && status) return `Moved to ${titleCase(status)}`;
  if (action === "NOTE") return "Internal note";
  if (action === "ASSIGNED") return "Assigned";
  if (action.startsWith("PRIORITY_")) return `Priority set to ${titleCase(action.slice(9))}`;
  return titleCase(action);
}

function Workflow({ complaint }: { complaint: ComplaintDetail }) {
  const update = useUpdateComplaint();
  const [resolution, setResolution] = useState(complaint.resolution ?? "");
  const [note, setNote] = useState("");
  const next = COMPLAINT_NEXT[complaint.status];

  async function move(status: ComplaintStatus) {
    await update.mutateAsync({
      id: complaint.id,
      status,
      resolution: status === "RESOLVED" ? resolution.trim() || undefined : undefined,
      note: note.trim() || undefined,
    });
    setNote("");
  }

  return (
    <Section title="Handle">
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Priority</span>
          <select
            value={complaint.priority}
            disabled={update.isPending}
            onChange={(event) => update.mutate({ id: complaint.id, priority: event.target.value as ComplaintPriority })}
            className={inputClass}
          >
            {COMPLAINT_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {titleCase(priority)}
              </option>
            ))}
          </select>
        </label>

        {next.length > 0 && (
          <>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Resolution (the user sees this — required to resolve)</span>
              <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} maxLength={2000} className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Internal note (never shown to the user)</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={2000} className={inputClass} />
            </label>
            <div className="flex flex-wrap gap-2">
              {next.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={update.isPending || (status === "RESOLVED" && !resolution.trim())}
                  onClick={() => void move(status)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
                    status === "RESOLVED"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : status === "CLOSED"
                        ? "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                        : "bg-bhagwa-500 text-white hover:bg-bhagwa-600"
                  }`}
                >
                  {ACTION_LABEL[status]}
                </button>
              ))}
              {note.trim() && (
                <button
                  type="button"
                  disabled={update.isPending}
                  onClick={() => void update.mutateAsync({ id: complaint.id, note: note.trim() }).then(() => setNote(""))}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  Add note only
                </button>
              )}
            </div>
          </>
        )}
        {!complaint.assignedAdmin && (
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: complaint.id, assignToMe: true })}
            className="flex items-center gap-2 text-sm font-medium text-bhagwa-600 hover:underline"
          >
            <UserCheck className="h-4 w-4" aria-hidden /> Assign to me
          </button>
        )}
        {update.isPending && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
          </p>
        )}
        {update.error && <p className="text-sm text-red-600">{update.error.message}</p>}
      </div>
    </Section>
  );
}

export function ComplaintDetailPage() {
  const { id = "" } = useParams();
  const { data: complaint, error, isPending } = useComplaint(id);

  if (isPending)
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading complaint…
      </p>
    );
  if (error || !complaint)
    return (
      <p className="flex items-center gap-2 text-sm text-red-600">
        <XCircle className="h-4 w-4" aria-hidden /> {error?.message ?? "Complaint not found"}
      </p>
    );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link to="/complaints" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-bhagwa-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Complaints
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-midnight">
            {complaint.ticketCode}
            <ComplaintStatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
          </h1>
          <p className="text-sm text-slate-500">
            {titleCase(complaint.category)} · reported {formatDateTime(complaint.createdAt)} by a {complaint.userRole.toLowerCase()}
            {complaint.assignedAdmin && ` · owner ${complaint.assignedAdmin.name}`}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Section title="Issue">
            <p className="text-lg font-semibold text-slate-900">{complaint.subject}</p>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{complaint.description}</p>
            {complaint.resolution && (
              <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <strong>Resolution sent to the user:</strong> {complaint.resolution}
              </p>
            )}
          </Section>

          <Section title="Ride">
            {complaint.ride ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Ride" value={<Link to={`/rides/${complaint.ride.id}`} className="font-mono text-bhagwa-600 hover:underline">{complaint.ride.rideCode}</Link>} />
                <Field label="Status" value={titleCase(complaint.ride.status)} />
                <Field label="Pickup" value={complaint.ride.pickupAddress} />
                <Field label="Destination" value={complaint.ride.destinationAddress} />
                <Field label="Fare" value={formatMoney(complaint.ride.finalFare ?? complaint.ride.estimatedFare)} />
                <Field label="Payment" value={titleCase(complaint.ride.paymentStatus)} />
                <Field label="Requested" value={formatDateTime(complaint.ride.requestedAt)} />
                <Field label="Completed" value={formatDateTime(complaint.ride.completedAt)} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Not about a specific ride.</p>
            )}
          </Section>

          <Section title="History">
            <ol className="space-y-3">
              {complaint.history.map((entry, index) => (
                <li key={index} className="flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${entry.action === "NOTE" ? "bg-slate-400" : "bg-bhagwa-500"}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {historyLabel(entry.action, entry.status)} <span className="font-normal text-slate-500">· {formatDateTime(entry.at)}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.by ?? "—"} ({titleCase(entry.byRole)})
                    </p>
                    {entry.note && <p className="mt-1 text-sm text-slate-700">{entry.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="space-y-5">
          <Workflow complaint={complaint} />
          <Section title="People">
            <dl className="space-y-4">
              {[
                { label: `Reported by (${complaint.userRole.toLowerCase()})`, person: complaint.user },
                { label: "Customer", person: complaint.userRole === "CUSTOMER" ? null : complaint.customer },
                { label: "Driver", person: complaint.driver },
              ]
                .filter((row) => row.person)
                .map((row) => (
                  <Field
                    key={row.label}
                    label={row.label}
                    value={
                      <>
                        {row.person!.name}
                        <a href={`tel:${row.person!.phone}`} className="ml-2 inline-flex items-center gap-1 text-bhagwa-600 hover:underline">
                          <Phone className="h-3 w-3" aria-hidden /> {row.person!.phone}
                        </a>
                      </>
                    }
                  />
                ))}
              {complaint.driver && (
                <Field
                  label="Driver profile"
                  value={<Link to={`/drivers/${complaint.driver.driverId}`} className="text-bhagwa-600 hover:underline">{complaint.driver.driverCode}</Link>}
                />
              )}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
