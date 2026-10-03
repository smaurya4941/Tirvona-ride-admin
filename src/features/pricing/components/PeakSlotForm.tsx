import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button, FormField, Modal, Notice, Toggle, inputClass } from "@/components/Ui";
import { formatMoney } from "@/lib/format";
import { previewFare, usePricing } from "../api/pricing";
import type { PricingRow } from "../api/pricing";
import { formatClock, previewPerKm, useSavePeakSlot } from "../api/peakPricing";
import type { PeakSlot } from "../api/peakPricing";

interface Draft {
  name: string;
  startTime: string;
  endTime: string;
  hike: string;
  appliesToAll: boolean;
  rideTypes: string[];
  isActive: boolean;
}

const toDraft = (slot?: PeakSlot): Draft => ({
  name: slot?.name ?? "",
  startTime: slot?.startTime ?? "16:00",
  endTime: slot?.endTime ?? "20:00",
  hike: slot ? String(slot.hikePercent) : "",
  appliesToAll: slot?.appliesToAll ?? true,
  rideTypes: slot?.rideTypes ?? [],
  isActive: slot?.isActive ?? true,
});

/** Same rules as the API (the server re-checks and also rejects overlaps). */
function validate(draft: Draft) {
  const errors: Partial<Record<"name" | "time" | "hike" | "rideTypes", string>> = {};
  if (draft.name.trim().length < 2) errors.name = "Give the slot a name (at least 2 characters)";
  if (!draft.startTime || !draft.endTime) errors.time = "Choose a start and an end time";
  else if (draft.startTime === draft.endTime) errors.time = "Start and end time must differ";
  const hike = Number(draft.hike);
  if (draft.hike.trim() === "" || !Number.isFinite(hike)) errors.hike = "Enter the hike percentage";
  else if (hike <= 0) errors.hike = "The hike must be more than 0%";
  else if (hike > 300) errors.hike = "At most 300%";
  else if (!/^\d+(\.\d{1,2})?$/.test(draft.hike.trim())) errors.hike = "Up to 2 decimals";
  if (!draft.appliesToAll && draft.rideTypes.length === 0) errors.rideTypes = "Choose at least one ride type";
  return { errors, hike };
}

/** What the hike does to each ride type's current tariff, on a sample trip. */
function Preview({ rows, draft, hike }: { rows: PricingRow[]; draft: Draft; hike: number }) {
  const covered = rows.filter((row) => row.pricing && (draft.appliesToAll || draft.rideTypes.includes(row.rideType.code)));
  if (!Number.isFinite(hike) || hike <= 0 || covered.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview · only the per-km rate changes</p>
      <table className="mt-2 w-full text-[13px]">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="py-1 font-medium">Ride type</th>
            <th className="py-1 font-medium">Per km</th>
            <th className="py-1 text-right font-medium">10 km · 15 min</th>
          </tr>
        </thead>
        <tbody>
          {covered.map(({ rideType, pricing }) => {
            if (!pricing) return null;
            const peakRate = previewPerKm(pricing.perKmRate, hike);
            const normal = previewFare(pricing, 10, 15).total;
            const peak = previewFare({ ...pricing, perKmRate: peakRate }, 10, 15).total;
            return (
              <tr key={rideType.code} className="border-t border-slate-200">
                <td className="py-1.5 font-medium text-slate-800">{rideType.displayName}</td>
                <td className="py-1.5">
                  {formatMoney(pricing.perKmRate)} → <span className="font-semibold text-bhagwa-600">{formatMoney(peakRate)}</span>
                </td>
                <td className="py-1.5 text-right">
                  {formatMoney(normal)} → <span className="font-semibold text-bhagwa-600">{formatMoney(peak)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PeakSlotForm({ slot, onClose }: { slot?: PeakSlot; onClose: () => void }) {
  const { data: rows = [] } = usePricing();
  const save = useSavePeakSlot();
  const [draft, setDraft] = useState<Draft>(() => toDraft(slot));
  const [submitted, setSubmitted] = useState(false);
  const { errors, hike } = useMemo(() => validate(draft), [draft]);
  const invalid = Object.keys(errors).length > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const shown = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    save.mutate(
      {
        id: slot?.id,
        input: {
          name: draft.name.trim(),
          startTime: draft.startTime,
          endTime: draft.endTime,
          hikePercent: hike,
          appliesToAll: draft.appliesToAll,
          rideTypes: draft.appliesToAll ? [] : draft.rideTypes,
          isActive: draft.isActive,
        },
      },
      { onSuccess: onClose },
    );
  }

  const crosses = draft.startTime && draft.endTime && draft.endTime < draft.startTime;

  return (
    <Modal title={slot ? `Edit ${slot.name}` : "Add peak slot"} onClose={save.isPending ? () => undefined : onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormField label="Peak slot name" error={shown("name")}>
          <input className={inputClass} value={draft.name} maxLength={60} placeholder="Evening Peak" onChange={(event) => set("name", event.target.value)} autoFocus />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start time" hint="Included">
            <input type="time" className={inputClass} value={draft.startTime} onChange={(event) => set("startTime", event.target.value)} />
          </FormField>
          <FormField label="End time" hint="Not included">
            <input type="time" className={inputClass} value={draft.endTime} onChange={(event) => set("endTime", event.target.value)} />
          </FormField>
        </div>
        {shown("time") && <p className="-mt-2 text-xs text-red-600">{errors.time}</p>}
        {crosses && !errors.time && (
          <p className="-mt-2 text-xs text-slate-500">
            Crosses midnight: runs from {formatClock(draft.startTime)} to {formatClock(draft.endTime)} the next day.
          </p>
        )}

        <FormField label="Hike on per-km rate (%)" error={shown("hike")} hint="Base fare, per-minute rate and minimum fare never change.">
          <input
            className={inputClass}
            inputMode="decimal"
            value={draft.hike}
            placeholder="50"
            onChange={(event) => set("hike", event.target.value)}
          />
        </FormField>

        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Applicable ride types</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="scope" checked={draft.appliesToAll} onChange={() => set("appliesToAll", true)} /> All ride types
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="scope" checked={!draft.appliesToAll} onChange={() => set("appliesToAll", false)} /> Selected ride types
            </label>
            {!draft.appliesToAll && (
              <div className="ml-6 flex flex-wrap gap-x-5 gap-y-2">
                {rows.map(({ rideType }) => (
                  <label key={rideType.code} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.rideTypes.includes(rideType.code)}
                      onChange={(event) =>
                        set("rideTypes", event.target.checked ? [...draft.rideTypes, rideType.code] : draft.rideTypes.filter((code) => code !== rideType.code))
                      }
                    />
                    {rideType.displayName}
                    {!rideType.isActive && <span className="text-[10px] uppercase text-slate-400">off</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
          {shown("rideTypes") && <p className="mt-1 text-xs text-red-600">{errors.rideTypes}</p>}
        </fieldset>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
          <span className="text-sm">
            <span className="font-medium text-slate-800">Active</span>
            <span className="block text-xs text-slate-500">A disabled slot is kept but never changes a fare.</span>
          </span>
          <Toggle checked={draft.isActive} onChange={(value) => set("isActive", value)} label="Active" />
        </div>

        <Preview rows={rows} draft={draft} hike={hike} />

        {save.error && <Notice tone="error">{save.error.message}</Notice>}
        <p className="text-xs text-slate-500">Applies to new estimates and bookings only. Rides already booked keep the price they were given.</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" busy={save.isPending}>
            {slot ? "Save changes" : "Add slot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
