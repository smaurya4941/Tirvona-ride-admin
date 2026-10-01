import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";

interface RejectDriverDialogProps {
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectDriverDialog({ isSubmitting, error, onCancel, onConfirm }: RejectDriverDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmed.length >= 3) onConfirm(trimmed);
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-midnight">Reject driver</h2>
        <p className="mt-1 text-sm text-slate-500">
          The driver sees this reason in the app and can fix their application and resubmit.
        </p>
        <textarea
          autoFocus
          rows={4}
          maxLength={300}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Driving licence photo is unclear"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || trimmed.length < 3}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Reject driver
          </button>
        </div>
      </form>
    </div>
  );
}
