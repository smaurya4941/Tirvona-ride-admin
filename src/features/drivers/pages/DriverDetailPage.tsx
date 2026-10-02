import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Ban, CheckCircle2, FileText, Loader2, RotateCcw, XCircle } from "lucide-react";
import { ConfirmDialog, Notice } from "@/components/Ui";
import { Link, useParams } from "react-router-dom";
import {
  documentFilePath,
  useApproveDriver,
  useDriver,
  useReinstateDriver,
  useRejectDriver,
  useSuspendDriver,
} from "../api/drivers";
import type { DriverDocument } from "../api/drivers";
import { useDriverChanges } from "@/features/driver-changes/api/driverChanges";
import { DocumentViewer } from "../components/DocumentViewer";
import { DriverStatusBadge, statusLabel } from "../components/DriverStatusBadge";
import { RejectDriverDialog } from "../components/RejectDriverDialog";

/** Changes this (approved) driver asked for that still wait for review. */
function PendingUpdatesNotice({ driverId }: { driverId: string }) {
  const { data } = useDriverChanges({ page: 1, status: "PENDING", driverId });
  if (!data || data.total === 0) return null;
  return (
    <Notice tone="warning">
      {data.total} update{data.total === 1 ? "" : "s"} waiting for review ({data.items.map((item) => item.label).join(", ")}).{" "}
      <Link className="font-semibold underline" to={`/driver-updates?driverId=${driverId}`}>
        Review
      </Link>
    </Notice>
  );
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="mb-4 text-base font-semibold text-midnight">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

function DocumentList({
  documents,
  onView,
}: {
  documents: DriverDocument[];
  onView: (document: DriverDocument) => void;
}) {
  if (documents.length === 0) return <p className="text-sm text-slate-500">No documents uploaded.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {documents.map((document) => (
        <li key={document.id} className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-slate-400" aria-hidden />
            <div>
              <p className="text-sm font-medium text-slate-900">{statusLabel(document.documentType)}</p>
              {document.documentNumber && <p className="font-mono text-xs text-slate-500">{document.documentNumber}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DriverStatusBadge status={document.status} />
            <button
              type="button"
              onClick={() => onView(document)}
              className="rounded-lg px-3 py-1 text-sm font-semibold text-bhagwa-600 hover:bg-bhagwa-50"
            >
              View
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DriverDetailPage() {
  const { id = "" } = useParams();
  const { data, error, isPending } = useDriver(id);
  const approve = useApproveDriver();
  const reject = useRejectDriver();
  const [viewing, setViewing] = useState<{ title: string; path: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const suspend = useSuspendDriver();
  const reinstate = useReinstateDriver();
  const [confirming, setConfirming] = useState<"approve" | "suspend" | "reinstate" | null>(null);

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading driver…
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

  const { driver, user, documents, vehicles } = data;
  // Mirrors the server's state machine: only UNDER_REVIEW can be decided.
  const canDecide = driver.driverStatus === "UNDER_REVIEW";
  const decisionError = approve.error?.message ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link to="/drivers" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All drivers
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-midnight">{[user.firstName, user.lastName].filter(Boolean).join(" ")}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span className="font-mono">{driver.driverCode}</span>
            <DriverStatusBadge status={driver.driverStatus} />
          </p>
        </div>

        {canDecide && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={approve.isPending}
              className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" aria-hidden /> Reject
            </button>
            <button
              type="button"
              onClick={() => setConfirming("approve")}
              disabled={approve.isPending}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {approve.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              )}
              Approve driver
            </button>
          </div>
        )}
        {driver.driverStatus === "APPROVED" && (
          <button
            type="button"
            onClick={() => setConfirming("suspend")}
            className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            <Ban className="h-4 w-4" aria-hidden /> Suspend
          </button>
        )}
        {driver.driverStatus === "SUSPENDED" && (
          <button
            type="button"
            onClick={() => setConfirming("reinstate")}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Reinstate
          </button>
        )}
      </header>

      {decisionError && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{decisionError}</p>}
      {driver.driverStatus === "REJECTED" && driver.rejectionReason && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          <span className="font-semibold">Rejected:</span> {driver.rejectionReason}
        </p>
      )}

      {driver.driverStatus === "SUSPENDED" && (
        <Notice tone="warning">
          Suspended {formatDate(driver.suspendedAt)}{driver.suspensionReason ? `: ${driver.suspensionReason}` : ""}. The driver cannot go online or take rides.
        </Notice>
      )}
      <PendingUpdatesNotice driverId={driver.id} />
      <p className="flex flex-wrap gap-4 text-sm">
        <Link className="font-semibold text-bhagwa-600 hover:underline" to={`/earnings/${driver.id}`}>Earnings & payouts</Link>
        <Link className="font-semibold text-bhagwa-600 hover:underline" to={`/driver-updates?status=APPROVED&driverId=${driver.id}`}>Update history</Link>
        <Link className="font-semibold text-bhagwa-600 hover:underline" to={`/audit-log?targetType=DRIVER&targetId=${driver.id}`}>Admin action history</Link>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Profile">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Phone" value={user.phone} />
            <Field label="Email" value={user.email} />
            <Field label="Licence number" value={driver.licenseNumber} />
            <Field label="Licence expiry" value={formatDate(driver.licenseExpiry)} />
            <Field label="Date of birth" value={formatDate(driver.dateOfBirth)} />
            <Field label="Phone verified" value={user.isPhoneVerified ? "Yes" : "No"} />
            <div className="col-span-2">
              <Field label="Address" value={driver.address} />
            </div>
            <Field label="Registered" value={formatDate(user.createdAt)} />
            <Field label="Approved" value={formatDate(driver.approvedAt)} />
            <Field label="Rating" value={driver.ratingAverage ? `${driver.ratingAverage.toFixed(2)} ★` : "No ratings"} />
            <Field label="Completed rides" value={String(driver.totalRides)} />
          </dl>
        </Section>

        <Section title="KYC documents">
          <DocumentList
            documents={documents}
            onView={(document) =>
              setViewing({
                title: statusLabel(document.documentType),
                path: documentFilePath.driver(driver.id, document.id),
              })
            }
          />
        </Section>
      </div>

      <Section title="Vehicles">
        {vehicles.length === 0 ? (
          <p className="text-sm text-slate-500">No vehicle registered.</p>
        ) : (
          <div className="space-y-5">
            {vehicles.map(({ vehicle, documents: vehicleDocuments }) => (
              <div key={vehicle.id} className={vehicle.isActive ? "" : "opacity-60"}>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Field label="Type" value={vehicle.vehicleType} />
                  <Field label="Registration" value={<span className="font-mono">{vehicle.registrationNumber}</span>} />
                  <Field label="Vehicle" value={[vehicle.make, vehicle.model].filter(Boolean).join(" ")} />
                  <Field
                    label="Colour / year"
                    value={[vehicle.color, vehicle.manufactureYear].filter(Boolean).join(" · ")}
                  />
                </dl>
                {!vehicle.isActive && <p className="mt-2 text-xs text-slate-500">Deactivated by driver</p>}
                {vehicleDocuments.length > 0 && (
                  <div className="mt-4">
                    <DocumentList
                      documents={vehicleDocuments}
                      onView={(document) =>
                        setViewing({
                          title: `${vehicle.registrationNumber} — ${statusLabel(document.documentType)}`,
                          path: documentFilePath.vehicle(document.id),
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {viewing && <DocumentViewer title={viewing.title} path={viewing.path} onClose={() => setViewing(null)} />}

      {confirming === "approve" && (
        <ConfirmDialog
          title="Approve this driver?"
          body="They can go online and receive ride requests immediately. Make sure every KYC document has been checked."
          confirmLabel="Approve driver"
          busy={approve.isPending}
          error={approve.error?.message}
          onCancel={() => { approve.reset(); setConfirming(null); }}
          onConfirm={() => approve.mutate(driver.id, { onSuccess: () => setConfirming(null) })}
        />
      )}
      {confirming === "suspend" && (
        <ConfirmDialog
          title="Suspend this driver?"
          body="They are taken offline at once and cannot take rides until reinstated. Refused while they are on a ride. The driver is notified."
          confirmLabel="Suspend driver"
          danger
          reasonLabel="Reason for suspension"
          busy={suspend.isPending}
          error={suspend.error?.message}
          onCancel={() => { suspend.reset(); setConfirming(null); }}
          onConfirm={(reason) => suspend.mutate({ id: driver.id, reason: reason ?? "" }, { onSuccess: () => setConfirming(null) })}
        />
      )}
      {confirming === "reinstate" && (
        <ConfirmDialog
          title="Reinstate this driver?"
          body="Their account becomes APPROVED again; they can go online themselves. The driver is notified."
          confirmLabel="Reinstate"
          reasonLabel="Note"
          reasonRequired={false}
          busy={reinstate.isPending}
          error={reinstate.error?.message}
          onCancel={() => { reinstate.reset(); setConfirming(null); }}
          onConfirm={(reason) => reinstate.mutate({ id: driver.id, reason }, { onSuccess: () => setConfirming(null) })}
        />
      )}

      {rejecting && (
        <RejectDriverDialog
          isSubmitting={reject.isPending}
          error={reject.error?.message ?? null}
          onCancel={() => {
            reject.reset();
            setRejecting(false);
          }}
          onConfirm={(reason) =>
            reject.mutate({ id: driver.id, reason }, { onSuccess: () => setRejecting(false) })
          }
        />
      )}
    </div>
  );
}
