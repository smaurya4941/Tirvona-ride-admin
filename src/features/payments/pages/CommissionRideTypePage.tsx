import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, CheckCircle2, Loader2, Percent, XCircle } from "lucide-react";
import { formatDateTime, titleCase } from "@/lib/format";
import { useCancelCommission, useRideTypeCommission, useUpdateCommission } from "../api/payments";
import type { CommissionPhase } from "../api/payments";

const phaseStyles: Record<CommissionPhase, string> = {
  CURRENT: "bg-emerald-100 text-emerald-800",
  SCHEDULED: "bg-sky-100 text-sky-800",
  SUPERSEDED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-slate-200 text-slate-500 line-through",
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500 disabled:bg-slate-50";

function EditCommission({ rideType, displayName, currentValue }: { rideType: string; displayName: string; currentValue: number }) {
  const update = useUpdateCommission(rideType);
  const [value, setValue] = useState(String(currentValue));
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const numeric = Number(value);
  const valueError =
    value.trim() === "" || !Number.isFinite(numeric)
      ? "Enter a percentage"
      : numeric < 0 || numeric > 100
        ? "Between 0 and 100"
        : !/^\d+(\.\d{1,2})?$/.test(value.trim())
          ? "Up to 2 decimals"
          : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valueError) return;
    setSaved(null);
    update.mutate(
      {
        value: numeric,
        // datetime-local is the admin's local time; send an absolute instant.
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          setSaved(
            created.phase === "SCHEDULED"
              ? `${displayName} v${created.version} (${created.value}%) is scheduled for ${formatDateTime(created.effectiveFrom)}. Until then the current rate stays.`
              : `${displayName} v${created.version} (${created.value}%) is now in force for rides finalised from now on.`,
          );
          setEffectiveFrom("");
          setNote("");
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-midnight">Edit commission</h2>
      <p className="mt-1 text-sm text-slate-500">
        Creates a new version for this ride type only. Rides already finalised keep the rate they were finalised at.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Ride type</span>
          <input value={displayName} disabled readOnly className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Commission (%)</span>
          <input
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={Boolean(valueError)}
            className={inputClass}
          />
          <span className={`mt-1 block text-xs ${valueError ? "text-red-600" : "text-slate-500"}`}>
            {valueError ?? "Percentage of the final fare"}
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Effective from</span>
          <input type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs text-slate-500">
            {effectiveFrom ? "Scheduled: the current rate stays until then" : "Leave empty to apply now"}
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Note</span>
          <input value={note} maxLength={240} placeholder="Optional" onChange={(event) => setNote(event.target.value)} className={inputClass} />
        </label>
      </div>
      {update.error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{update.error.message}</p>}
      {saved && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> {saved}
        </p>
      )}
      <button
        type="submit"
        disabled={Boolean(valueError) || update.isPending}
        className="mt-5 flex items-center gap-2 rounded-lg bg-bhagwa-500 px-4 py-2 text-sm font-semibold text-white hover:bg-bhagwa-600 disabled:opacity-50"
      >
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Save commission
      </button>
    </form>
  );
}

/** One ride type: what applies now, what is scheduled, the edit form and the full history. */
export function CommissionRideTypePage() {
  const { rideType = "" } = useParams();
  const { data, error, isPending } = useRideTypeCommission(rideType);
  const cancel = useCancelCommission();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link to="/commission" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All ride types
      </Link>

      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : error ? (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" aria-hidden /> {error.message}
        </p>
      ) : (
        <>
          <header>
            <h1 className="text-2xl font-bold text-midnight">{data.rideType.displayName} commission</h1>
            <p className="text-sm text-slate-500">Applies to {data.rideType.displayName} rides only.</p>
          </header>

          <section className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bhagwa-100 text-bhagwa-600">
              <Percent className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Current commission</p>
              <p className="text-3xl font-bold text-midnight">{data.current ? `${data.current.value}%` : "—"}</p>
              {data.current && (
                <p className="text-sm text-slate-500">
                  Active since {formatDateTime(data.current.effectiveFrom)} · v{data.current.version}
                </p>
              )}
            </div>
            {data.scheduled.map((next) => (
              <div key={next.id} className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
                <p className="text-xs font-semibold uppercase tracking-wide">Scheduled commission</p>
                <p className="mt-0.5 flex items-center gap-2 text-lg font-bold">
                  <CalendarClock className="h-4 w-4" aria-hidden /> {next.value}%
                </p>
                <p className="text-xs">Effective {formatDateTime(next.effectiveFrom)}</p>
              </div>
            ))}
          </section>

          <EditCommission
            key={`${data.current?.id}-${data.scheduled.length}`}
            rideType={data.rideType.code}
            displayName={data.rideType.displayName}
            currentValue={data.current?.value ?? 0}
          />

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-midnight">History</h2>
            {cancel.error && <p className="bg-red-50 px-5 py-2 text-sm text-red-700">{cancel.error.message}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Version</th>
                    <th className="px-5 py-3 font-medium">Rate</th>
                    <th className="px-5 py-3 font-medium">Effective from</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Note</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.history.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-3 font-mono text-xs">v{entry.version}</td>
                      <td className="px-5 py-3 font-semibold">{entry.value}%</td>
                      <td className="px-5 py-3 text-slate-700">{formatDateTime(entry.effectiveFrom)}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${phaseStyles[entry.phase]}`}>{titleCase(entry.phase)}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{entry.note ?? "—"}</td>
                      <td className="px-5 py-3 text-right">
                        {entry.phase === "SCHEDULED" && (
                          <button
                            type="button"
                            disabled={cancel.isPending}
                            onClick={() => cancel.mutate(entry.id)}
                            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              See <Link className="font-semibold text-bhagwa-600 hover:underline" to={`/audit-log?targetType=COMMISSION&targetId=${data.rideType.code}`}>who changed what</Link>.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
