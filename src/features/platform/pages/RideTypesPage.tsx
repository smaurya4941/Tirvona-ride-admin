import { useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, ConfirmDialog, FormField, LoadState, Modal, Notice, PageHeader, Pill, Table, Toggle, cell, inputClass } from "@/components/Ui";
import { formatMoney, titleCase } from "@/lib/format";
import { RIDE_TYPE_ICONS, VEHICLE_TYPES, useCreateRideType, useRideTypes, useSetTariff, useUpdateRideType7 } from "../api";
import type { CreateRideTypeInput, RideTypeRow, VehicleType } from "../api";

const RATES = [
  { key: "baseFare", label: "Base fare", max: 5_000 },
  { key: "perKmRate", label: "Per km", max: 500 },
  { key: "perMinuteRate", label: "Per minute", max: 100 },
  { key: "minimumFare", label: "Minimum fare", max: 10_000 },
] as const;
type RateKey = (typeof RATES)[number]["key"];
type RateDraft = Record<RateKey, string>;

function parseRates(draft: RateDraft): { rates: Record<RateKey, number> | null; error?: string } {
  const rates = {} as Record<RateKey, number>;
  for (const { key, label, max } of RATES) {
    const value = Number(draft[key]);
    if (draft[key].trim() === "" || !Number.isFinite(value) || value < 0 || value > max || !/^\d+(\.\d{1,2})?$/.test(draft[key].trim()))
      return { rates: null, error: `${label}: enter 0–${max} with at most 2 decimals` };
    rates[key] = value;
  }
  return { rates };
}

function RateInputs({ draft, onChange }: { draft: RateDraft; onChange: (draft: RateDraft) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {RATES.map(({ key, label }) => (
        <FormField key={key} label={`${label} (₹)`}>
          <input inputMode="decimal" value={draft[key]} onChange={(event) => onChange({ ...draft, [key]: event.target.value })} className={inputClass} />
        </FormField>
      ))}
    </div>
  );
}

const emptyRates: RateDraft = { baseFare: "", perKmRate: "", perMinuteRate: "", minimumFare: "" };

function RideTypeForm({ row, onClose }: { row?: RideTypeRow; onClose: () => void }) {
  const create = useCreateRideType();
  const update = useUpdateRideType7();
  const [form, setForm] = useState({
    code: row?.rideType.code ?? "",
    displayName: row?.rideType.displayName ?? "",
    description: row?.rideType.description ?? "",
    icon: row?.rideType.icon ?? "cab",
    vehicleType: (row?.rideType.vehicleType ?? "CAB") as VehicleType,
    seatCapacity: String(row?.rideType.seatCapacity ?? 4),
    sortOrder: String(row?.rideType.sortOrder ?? 50),
  });
  const [withTariff, setWithTariff] = useState(false);
  const [rates, setRates] = useState<RateDraft>(emptyRates);
  const [error, setError] = useState<string | null>(null);
  const mutation = row ? update : create;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!row && !/^[A-Z][A-Z0-9_]{1,23}$/.test(form.code)) return setError("Code: 2–24 upper-case letters, digits or underscores, starting with a letter");
    if (form.displayName.trim().length < 2) return setError("Enter a display name");
    const seats = Number(form.seatCapacity);
    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(seats) || seats < 1 || seats > 8) return setError("Seats: 1–8");
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100) return setError("Sort order: 0–100");
    const common = {
      displayName: form.displayName.trim(),
      description: form.description.trim(),
      icon: form.icon,
      vehicleType: form.vehicleType,
      seatCapacity: seats,
      sortOrder,
    };
    if (row) {
      update.mutate({ code: row.rideType.code, ...common }, { onSuccess: onClose });
      return;
    }
    let pricing: CreateRideTypeInput["pricing"];
    if (withTariff) {
      const parsed = parseRates(rates);
      if (!parsed.rates) return setError(parsed.error ?? "Check the tariff");
      pricing = parsed.rates;
    }
    create.mutate({ code: form.code, ...common, isActive: Boolean(pricing), pricing }, { onSuccess: onClose });
  }

  return (
    <Modal title={row ? `Edit ${row.rideType.displayName}` : "New ride type"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Code" hint={row ? "Codes never change (historical rides use them)" : "e.g. CAB_XL"}>
            <input value={form.code} disabled={Boolean(row)} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className={inputClass} maxLength={24} />
          </FormField>
          <FormField label="Display name">
            <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className={inputClass} maxLength={40} />
          </FormField>
        </div>
        <FormField label="Description" hint="Shown to customers under the name">
          <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} maxLength={160} />
        </FormField>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FormField label="Served by" hint="Drivers of this vehicle type">
            <select value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value as VehicleType })} className={inputClass}>
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="App icon">
            <select value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} className={inputClass}>
              {RIDE_TYPE_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {titleCase(icon)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Seats">
            <input inputMode="numeric" value={form.seatCapacity} onChange={(event) => setForm({ ...form, seatCapacity: event.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Order">
            <input inputMode="numeric" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} className={inputClass} />
          </FormField>
        </div>
        {!row && (
          <div className="rounded-xl border border-slate-200 p-3">
            <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
              <input type="checkbox" checked={withTariff} onChange={(event) => setWithTariff(event.target.checked)} />
              Set the tariff now and make it bookable
            </label>
            {withTariff && (
              <div className="mt-3">
                <RateInputs draft={rates} onChange={setRates} />
              </div>
            )}
            {!withTariff && <p className="mt-1 text-xs text-slate-500">Without a tariff it is created switched off.</p>}
          </div>
        )}
        {row && <p className="text-xs text-slate-500">Changes apply to new bookings only. Booked and past rides keep what they were booked with.</p>}
        {(error || mutation.error) && <Notice tone="error">{error ?? mutation.error?.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={mutation.isPending}>
            {row ? "Save" : "Create ride type"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TariffForm({ row, onClose }: { row: RideTypeRow; onClose: () => void }) {
  const setTariff = useSetTariff();
  const [rates, setRates] = useState<RateDraft>(emptyRates);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title={`Set the ${row.rideType.displayName} tariff`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseRates(rates);
          if (!parsed.rates) return setError(parsed.error ?? "Check the tariff");
          setTariff.mutate({ code: row.rideType.code, ...parsed.rates }, { onSuccess: onClose });
        }}
        className="space-y-4"
      >
        <RateInputs draft={rates} onChange={setRates} />
        {(error || setTariff.error) && <Notice tone="error">{error ?? setTariff.error?.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={setTariff.isPending}>
            Save tariff
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function RideTypesPage() {
  const { data, error, isPending } = useRideTypes();
  const update = useUpdateRideType7();
  const [editing, setEditing] = useState<RideTypeRow | "new" | null>(null);
  const [tariffFor, setTariffFor] = useState<RideTypeRow | null>(null);
  const [toggling, setToggling] = useState<RideTypeRow | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Ride types"
        subtitle="The products customers book. Never deleted — switch one off and past rides stay readable."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> New ride type
          </Button>
        }
      />
      {update.error && !toggling && <Notice tone="error">{update.error.message}</Notice>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <LoadState pending={isPending} error={error} empty={data?.length === 0}>
          <Table head={["Ride type", "Served by", "Seats", "Tariff", "Bookable", ""]}>
            {data?.map((row) => (
              <tr key={row.rideType.code} className={row.rideType.isActive ? "" : "bg-slate-50/60"}>
                <td className={cell}>
                  <p className="font-semibold text-slate-900">{row.rideType.displayName}</p>
                  <p className="font-mono text-xs text-slate-500">{row.rideType.code}</p>
                  {row.rideType.description && <p className="text-xs text-slate-500">{row.rideType.description}</p>}
                </td>
                <td className={cell}>{titleCase(row.rideType.vehicleType)}</td>
                <td className={`${cell} tabular-nums`}>{row.rideType.seatCapacity}</td>
                <td className={cell}>
                  {row.pricing ? (
                    <Link to="/pricing" className="text-slate-700 hover:underline">
                      {formatMoney(row.pricing.baseFare)} + {formatMoney(row.pricing.perKmRate)}/km · min {formatMoney(row.pricing.minimumFare)}
                      <span className="block text-xs text-slate-400">v{row.pricing.version}</span>
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setTariffFor(row)} className="font-semibold text-bhagwa-600 hover:underline">
                      Set tariff
                    </button>
                  )}
                </td>
                <td className={cell}>
                  <div className="flex items-center gap-2">
                    <Toggle checked={row.rideType.isActive} label={`${row.rideType.displayName} bookable`} onChange={() => setToggling(row)} />
                    {row.rideType.isActive ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>}
                  </div>
                </td>
                <td className={`${cell} text-right`}>
                  <button type="button" onClick={() => setEditing(row)} className="font-semibold text-bhagwa-600 hover:underline">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        </LoadState>
      </section>

      {editing && <RideTypeForm row={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {tariffFor && <TariffForm row={tariffFor} onClose={() => setTariffFor(null)} />}
      {toggling && (
        <ConfirmDialog
          title={toggling.rideType.isActive ? `Switch off ${toggling.rideType.displayName}?` : `Make ${toggling.rideType.displayName} bookable?`}
          body={
            toggling.rideType.isActive
              ? "Customers stop seeing it at once. Rides already booked continue normally."
              : "Customers can book it immediately (a tariff is required)."
          }
          confirmLabel={toggling.rideType.isActive ? "Switch off" : "Activate"}
          danger={toggling.rideType.isActive}
          reasonLabel={toggling.rideType.isActive ? "Why is it being switched off?" : undefined}
          busy={update.isPending}
          error={update.error?.message}
          onCancel={() => {
            update.reset();
            setToggling(null);
          }}
          onConfirm={(reason) =>
            update.mutate({ code: toggling.rideType.code, isActive: !toggling.rideType.isActive, reason }, { onSuccess: () => setToggling(null) })
          }
        />
      )}
    </div>
  );
}
