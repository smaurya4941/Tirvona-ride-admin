import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useCancellationReasons } from "@/features/platform/api";

interface CancelRideDialogProps {
  rideCode: string;
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (note: string, reasonCode?: string) => void;
}

/** Admin cancellation: a controlled ADMIN reason plus a note kept in the audit log. Never charges a fee. */
export function CancelRideDialog({ rideCode, isSubmitting, error, onCancel, onConfirm }: CancelRideDialogProps) {
  const { data: reasons } = useCancellationReasons();
  const adminReasons = (reasons ?? []).filter((reason) => reason.actor === "ADMIN" && reason.isActive);
  const [reasonCode, setReasonCode] = useState<string>("");
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const code = reasonCode || adminReasons[0]?.code;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmed.length >= 3) onConfirm(trimmed, code);
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-midnight">Cancel ride {rideCode}</h2>
        <p className="mt-1 text-sm text-slate-500">
          The customer and driver are notified, any assigned driver is freed, and no cancellation fee is charged. This cannot be undone.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-800">
          Reason
          <select
            value={code ?? ""}
            onChange={(event) => setReasonCode(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
          >
            {adminReasons.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-800">
          Note (kept in the audit log)
          <textarea
            autoFocus
            rows={3}
            maxLength={240}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Customer called support to cancel"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Keep ride
          </button>
          <button
            type="submit"
            disabled={isSubmitting || trimmed.length < 3}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Cancel ride
          </button>
        </div>
      </form>
    </div>
  );
}
