import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";

interface CompleteRideDialogProps {
  rideCode: string;
  /** The driver asked to end the trip, so the fare stops at that moment; otherwise at completion. */
  endRequested: boolean;
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

/** Ops ends a stuck trip without the rider's code. The note is kept on the ride and in the audit log. */
export function CompleteRideDialog({ rideCode, endRequested, isSubmitting, error, onCancel, onConfirm }: CompleteRideDialogProps) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmed.length >= 3) onConfirm(trimmed);
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-midnight">Complete ride {rideCode}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ends the trip without the rider&apos;s end-of-trip code and opens the bill.{" "}
          {endRequested
            ? "The fare is priced up to the moment the driver asked to end the trip."
            : "The driver has not asked to end the trip yet, so the fare is priced up to now."}{" "}
          The rider and driver are notified. This cannot be undone.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-800">
          Note (kept on the ride and in the audit log)
          <textarea
            autoFocus
            rows={3}
            maxLength={240}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Rider unreachable; driver confirmed the drop-off"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Keep ride open
          </button>
          <button
            type="submit"
            disabled={isSubmitting || trimmed.length < 3}
            className="flex items-center gap-2 rounded-lg bg-midnight px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Complete ride
          </button>
        </div>
      </form>
    </div>
  );
}
