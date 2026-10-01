import { useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Field, Section } from "@/components/DetailUi";
import { Button, ConfirmDialog, LoadState, Notice, Table, cell } from "@/components/Ui";
import { formatDateTime } from "@/lib/format";
import { DocumentViewer } from "@/features/drivers/components/DocumentViewer";
import { DriverStatusBadge } from "@/features/drivers/components/DriverStatusBadge";
import { documentFilePath } from "@/features/drivers/api/drivers";
import {
  displayValue,
  driverChangeFilePath,
  fieldLabel,
  useApproveDriverChange,
  useDriverChange,
  useRejectDriverChange,
} from "../api/driverChanges";
import type { DriverChange } from "../api/driverChanges";
import { DriverChangeStatusPill } from "../components/DriverChangeStatusPill";

const isDocument = (change: DriverChange) => change.kind === "DRIVER_DOCUMENT" || change.kind === "VEHICLE_DOCUMENT";

/** One driver update: what is on file, what was asked, and the decision. */
export function DriverChangeDetailPage() {
  const { id = "" } = useParams();
  const { data: change, error, isPending } = useDriverChange(id);
  const approve = useApproveDriverChange();
  const reject = useRejectDriverChange();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [viewing, setViewing] = useState<{ title: string; path: string } | null>(null);

  const currentDocumentPath =
    change && isDocument(change) && typeof change.previous.documentId === "string"
      ? change.kind === "DRIVER_DOCUMENT"
        ? documentFilePath.driver(change.driver.id, change.previous.documentId)
        : documentFilePath.vehicle(change.previous.documentId)
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/driver-updates" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Driver updates
      </Link>
      <LoadState pending={isPending} error={error}>
        {change && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-midnight">{change.label}</h1>
                <p className="text-sm text-slate-500">
                  Sent {formatDateTime(change.submittedAt)} by{" "}
                  <Link to={`/drivers/${change.driver.id}`} className="font-medium text-bhagwa-600 hover:underline">
                    {change.driver.name}
                  </Link>{" "}
                  ({change.driver.driverCode})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DriverChangeStatusPill status={change.status} />
                <DriverStatusBadge status={change.driver.driverStatus} />
              </div>
            </header>

            {change.status === "PENDING" && (
              <Notice tone="warning">
                The driver keeps their verified details until you approve. Approving applies the change at once
                {isDocument(change) ? " and marks the document verified" : ""}; the driver is notified either way.
              </Notice>
            )}

            <Section title="Requested change">
              {Object.keys(change.changes).length === 0 && !isDocument(change) ? (
                <p className="text-sm text-slate-500">No field changes.</p>
              ) : (
                <Table head={["Field", "On file now", "Requested"]}>
                  {isDocument(change) && (
                    <tr>
                      <td className={cell}>Document</td>
                      <td className={cell}>
                        {currentDocumentPath ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium text-bhagwa-600 hover:underline"
                            onClick={() => setViewing({ title: `${change.label} — on file`, path: currentDocumentPath })}
                          >
                            <FileText className="h-4 w-4" aria-hidden /> View current
                          </button>
                        ) : (
                          "None on file"
                        )}
                      </td>
                      <td className={cell}>
                        {change.hasFile ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-semibold text-bhagwa-600 hover:underline"
                            onClick={() => setViewing({ title: `${change.label} — submitted`, path: driverChangeFilePath(change.id) })}
                          >
                            <FileText className="h-4 w-4" aria-hidden /> View upload
                          </button>
                        ) : (
                          <span className="text-slate-500">Removed after the decision</span>
                        )}
                      </td>
                    </tr>
                  )}
                  {Object.entries(change.changes).map(([field, value]) => (
                    <tr key={field}>
                      <td className={cell}>{fieldLabel(field)}</td>
                      <td className={`${cell} text-slate-600`}>{displayValue(change.previous[field])}</td>
                      <td className={`${cell} font-semibold text-slate-900`}>{displayValue(value)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>

            {change.status !== "PENDING" && (
              <Section title="Decision">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status" value={<DriverChangeStatusPill status={change.status} />} />
                  <Field label="Reviewed" value={formatDateTime(change.reviewedAt)} />
                  {change.reviewNote && <Field label="Reason given to the driver" value={change.reviewNote} />}
                </dl>
              </Section>
            )}

            {change.status === "PENDING" && (
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="danger" onClick={() => setDialog("reject")}>
                  <XCircle className="h-4 w-4" aria-hidden /> Reject
                </Button>
                <Button onClick={() => setDialog("approve")}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve and apply
                </Button>
              </div>
            )}

            {dialog === "approve" && (
              <ConfirmDialog
                title={`Approve ${change.label.toLowerCase()}?`}
                body="The change replaces the verified details now. Check the uploaded document matches before approving."
                confirmLabel="Approve and apply"
                busy={approve.isPending}
                error={approve.error?.message}
                onCancel={() => setDialog(null)}
                onConfirm={() => approve.mutate(change.id, { onSuccess: () => setDialog(null) })}
              />
            )}
            {dialog === "reject" && (
              <ConfirmDialog
                title={`Reject ${change.label.toLowerCase()}?`}
                body="The driver sees this reason and can send a corrected update. Their verified details stay as they are."
                confirmLabel="Reject"
                danger
                reasonLabel="Reason for the driver"
                busy={reject.isPending}
                error={reject.error?.message}
                onCancel={() => setDialog(null)}
                onConfirm={(reason) =>
                  reason && reject.mutate({ id: change.id, reason }, { onSuccess: () => setDialog(null) })
                }
              />
            )}
            {viewing && <DocumentViewer title={viewing.title} path={viewing.path} onClose={() => setViewing(null)} />}
          </>
        )}
      </LoadState>
    </div>
  );
}
