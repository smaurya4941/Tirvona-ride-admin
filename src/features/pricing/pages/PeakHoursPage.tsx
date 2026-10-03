import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { Button, ConfirmDialog, LoadState, Notice, PageHeader, Pill, Table, Toggle, cell } from "@/components/Ui";
import { formatMoney } from "@/lib/format";
import { PeakSlotForm } from "../components/PeakSlotForm";
import { PricingTabs } from "../components/PricingTabs";
import {
  formatWindow,
  useDeletePeakSlot,
  usePeakSlots,
  usePeakStatus,
  useSetPeakSlotActive,
} from "../api/peakPricing";
import type { PeakSlot } from "../api/peakPricing";

/** "CURRENTLY NORMAL / PEAK PRICING" per ride type, from the server clock. */
function StatusPanel() {
  const { data, error } = usePeakStatus();
  if (error) return <Notice tone="error">{error.message}</Notice>;
  if (!data) return null;
  const priced = data.rideTypes.filter((row) => row.hasTariff);
  return (
    <section
      className={`rounded-xl border p-5 shadow-sm ${data.isPeak ? "border-bhagwa-500/40 bg-bhagwa-50" : "border-slate-200 bg-white"}`}
      aria-label="Current pricing status"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${data.isPeak ? "bg-bhagwa-500 text-white" : "bg-slate-100 text-slate-500"}`}>
          <Zap className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-bold tracking-wide text-midnight">{data.isPeak ? "CURRENTLY PEAK PRICING" : "CURRENTLY NORMAL PRICING"}</h2>
          <p className="text-xs text-slate-500">
            Server time{" "}
            {new Date(data.now).toLocaleTimeString("en-IN", { timeZone: data.timeZone, hour: "numeric", minute: "2-digit" })} ({data.timeZone})
          </p>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {priced.map((row) => (
          <div key={row.rideType} className="rounded-lg bg-white/70 p-3 ring-1 ring-slate-200">
            <dt className="flex items-center justify-between text-sm font-semibold text-slate-800">
              {row.displayName}
              {!row.isActive && <span className="text-[10px] uppercase text-slate-400">off</span>}
            </dt>
            <dd className="mt-1 text-sm">
              {row.peak ? (
                <>
                  <span className="text-lg font-bold text-bhagwa-600">{formatMoney(row.currentPerKmRate)}/km</span>{" "}
                  <span className="text-slate-500">(+{row.peak.hikePercent}%)</span>
                  <span className="block text-xs text-slate-500">
                    {row.peak.name} · normal {formatMoney(row.basePerKmRate)}/km
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold text-slate-800">{formatMoney(row.basePerKmRate)}/km</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PeakHoursPage() {
  const { data, error, isPending } = usePeakSlots();
  const setActive = useSetPeakSlotActive();
  const remove = useDeletePeakSlot();
  const [editing, setEditing] = useState<PeakSlot | "new" | null>(null);
  const [deleting, setDeleting] = useState<PeakSlot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const toggle = (slot: PeakSlot, isActive: boolean) => {
    setNotice(null);
    setActive.mutate({ id: slot.id, isActive }, { onError: (failure) => setNotice(failure.message) });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Pricing"
        subtitle="Peak hours raise only the per-km rate, for the times and ride types you choose. Fares are always calculated by the server."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> Add peak slot
          </Button>
        }
      />
      <PricingTabs />
      <StatusPanel />
      {notice && <Notice tone="error">{notice}</Notice>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-midnight">Peak slots</h2>
          <p className="text-xs text-slate-500">
            Start time is included, end time is not. Slots for the same ride type cannot overlap. Times are in {data?.timeZone ?? "the business time zone"}. A change affects new estimates and bookings only;
            booked rides keep their price. See <Link to="/audit-log?targetType=PEAK_SLOT" className="font-semibold text-bhagwa-600 hover:underline">who changed what</Link>.
          </p>
        </div>
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No peak slots yet. Add one to start charging peak rates.">
          <Table head={["Peak slot", "Time", "Hike", "Ride types", "Status", ""]}>
            {data?.items.map((slot) => (
              <tr key={slot.id} className={slot.isActive ? "" : "bg-slate-50/60 text-slate-500"}>
                <td className={`${cell} font-medium text-slate-900`}>
                  {slot.name}
                  {slot.isLive && (
                    <span className="ml-2">
                      <Pill tone="brand">Live now</Pill>
                    </span>
                  )}
                </td>
                <td className={cell}>
                  {formatWindow(slot)}
                  {slot.crossesMidnight && <span className="block text-xs text-slate-400">crosses midnight</span>}
                </td>
                <td className={`${cell} font-semibold`}>+{slot.hikePercent}%</td>
                <td className={cell}>{slot.appliesToAll ? "All" : slot.rideTypes.join(", ")}</td>
                <td className={cell}>
                  <Toggle checked={slot.isActive} onChange={(value) => toggle(slot, value)} label={`${slot.name} active`} disabled={setActive.isPending} />
                </td>
                <td className={`${cell} text-right`}>
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => setEditing(slot)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Edit" aria-label={`Edit ${slot.name}`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => (slot.isActive ? setNotice(`Disable “${slot.name}” before deleting it.`) : setDeleting(slot))}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title={slot.isActive ? "Disable first to delete" : "Delete"}
                      aria-label={`Delete ${slot.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </LoadState>
      </section>

      {editing && <PeakSlotForm slot={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body="The slot is removed for good. Rides that were priced with it keep their price. To pause it instead, leave it disabled."
          confirmLabel="Delete slot"
          danger
          busy={remove.isPending}
          error={remove.error?.message}
          onCancel={() => {
            remove.reset();
            setDeleting(null);
          }}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        />
      )}
    </div>
  );
}
