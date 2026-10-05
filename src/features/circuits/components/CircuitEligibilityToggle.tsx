import { useState } from "react";
import { Route } from "lucide-react";
import { ConfirmDialog, Toggle } from "@/components/Ui";
import { apiClient, useApiMutation } from "@/lib/api/hooks";
import type { ApiSuccess } from "@/lib/api/client";

/** Whether matching may offer this driver circuit rides. Audited; applies from the next offer. */
export function CircuitEligibilityToggle({ driverId, eligible }: { driverId: string; eligible: boolean }) {
  const [pending, setPending] = useState<boolean | null>(null);
  const update = useApiMutation(
    ({ value, reason }: { value: boolean; reason?: string }) =>
      apiClient.patch<ApiSuccess<{ circuitEligible: boolean }>>(`/admin/circuit-rides/drivers/${driverId}/eligibility`, { eligible: value, reason }),
    [["admin", "drivers"]],
  );

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Route className="h-5 w-5 text-bhagwa-500" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-900">Circuit rides</p>
          <p className="text-xs text-slate-500">{eligible ? "Can be offered multi-stop circuits." : "Not offered circuits; normal rides are unaffected."}</p>
        </div>
      </div>
      <Toggle checked={eligible} label="Offer circuit rides" disabled={update.isPending} onChange={(value) => setPending(value)} />
      {pending !== null && (
        <ConfirmDialog
          title={pending ? "Offer circuits to this driver?" : "Stop offering circuits to this driver?"}
          body={pending ? "They become eligible from the next offer." : "Circuits already accepted continue. New circuit offers go to other drivers."}
          confirmLabel={pending ? "Allow" : "Stop offering"}
          danger={!pending}
          reasonLabel="Reason"
          reasonRequired={!pending}
          busy={update.isPending}
          error={update.error?.message}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => update.mutate({ value: pending, reason }, { onSuccess: () => setPending(null) })}
        />
      )}
    </div>
  );
}
