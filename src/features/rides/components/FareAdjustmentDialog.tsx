import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface FareAdjustmentDialogProps {
  rideCode: string;
  /** What the customer owes now, rupees. */
  payable: number;
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (adjustment: { type: "CREDIT" | "CHARGE"; amount: number; reason: string; customerConsent?: boolean }) => void;
}

/**
 * Ops corrects a completed ride's fare before the customer starts paying.
 * A credit lowers the bill; a charge raises it and needs the customer's
 * consent. Both are appended to the ride and written to the audit log.
 */
export function FareAdjustmentDialog({ rideCode, payable, isSubmitting, error, onCancel, onConfirm }: FareAdjustmentDialogProps) {
  const [type, setType] = useState<"CREDIT" | "CHARGE">("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const value = Number(amount);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && value > 0 && value <= 10_000;
  const after = valid ? payable + (type === "CREDIT" ? -value : value) : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    if (!valid) return setProblem("Enter an amount above ₹0 and up to ₹10,000 (at most 2 decimals)");
    if (reason.trim().length < 5) return setProblem("Give a reason of at least 5 characters");
    if (type === "CHARGE" && !consent) return setProblem("Charging more needs the customer's consent");
    if (after !== null && after < 1) return setProblem("The amount payable cannot go below ₹1");
    onConfirm({ type, amount: value, reason: reason.trim(), ...(type === "CHARGE" ? { customerConsent: true } : {}) });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Adjust fare for ${rideCode}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" noValidate>
        <h2 className="text-lg font-semibold text-midnight">Adjust fare · {rideCode}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only possible before the customer starts paying. Once a payment has begun, wait for it to settle and use a refund instead. The customer and driver see the new amount at once.
        </p>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-800">Type</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(
              [
                { value: "CREDIT", label: "Credit", hint: "Customer pays less" },
                { value: "CHARGE", label: "Charge", hint: "Customer pays more" },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-lg border p-3 text-sm ${type === option.value ? "border-bhagwa-500 bg-bhagwa-50" : "border-slate-200"}`}
              >
                <input type="radio" name="adjustmentType" className="mr-2" checked={type === option.value} onChange={() => setType(option.value)} />
                <span className="font-semibold">{option.label}</span>
                <span className="block text-xs text-slate-500">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block text-sm font-medium text-slate-800">
          Amount (₹)
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
          />
        </label>
        {after !== null && (
          <p className="mt-1 text-xs text-slate-600">
            Customer pays {formatMoney(payable)} → <span className="font-semibold">{formatMoney(after)}</span>
          </p>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-800">
          Reason (kept on the ride and in the audit log)
          <textarea
            rows={3}
            maxLength={240}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={type === "CREDIT" ? "e.g. Driver took a longer route; goodwill credit" : "e.g. Toll paid by the driver, customer agreed"}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
          />
        </label>

        {type === "CHARGE" && (
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-800">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            The customer has agreed to pay this extra amount.
          </label>
        )}

        {(problem || error) && <p className="mt-3 text-sm text-red-600">{problem ?? error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-midnight px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Apply {type === "CREDIT" ? "credit" : "charge"}
          </button>
        </div>
      </form>
    </div>
  );
}
