import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterTabs, Pager, Section } from "@/components/DetailUi";
import { Button, ConfirmDialog, FormField, LoadState, Modal, Notice, PageHeader, Pill, SearchBox, Table, Toggle, cell, inputClass } from "@/components/Ui";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import {
  useCancellationPolicy,
  useCancellationReasons,
  useCancellations,
  useCreateReason,
  useResolveFee,
  useSavePolicy,
  useUpdateReason,
} from "../api";
import type { Actor, CancellationRecord, CustomerFeePolicy, FeeStatus } from "../api";

type Tab = "records" | "reasons" | "policy";

const feeTone = (status: FeeStatus) => (status === "DUE" ? "amber" : status === "COLLECTED" ? "green" : status === "WAIVED" ? "blue" : "slate");

function Records() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("q") ?? "";
  const cancelledBy = (["CUSTOMER", "DRIVER", "ADMIN"] as const).find((value) => value === params.get("by"));
  const feeStatus = (["DUE", "WAIVED", "COLLECTED"] as const).find((value) => value === params.get("feeStatus"));
  const { data, error, isPending, isFetching } = useCancellations({ page, search, cancelledBy, feeStatus });
  const resolve = useResolveFee();
  const [resolving, setResolving] = useState<{ record: CancellationRecord; status: "WAIVED" | "COLLECTED" } | null>(null);

  function update(next: { q?: string; by?: Actor; feeStatus?: FeeStatus; page?: number }) {
    const merged = { q: search, by: cancelledBy, feeStatus, page: 1, ...next };
    const out: Record<string, string> = { tab: "records" };
    if (merged.q) out.q = merged.q;
    if (merged.by) out.by = merged.by;
    if (merged.feeStatus) out.feeStatus = merged.feeStatus;
    if (merged.page > 1) out.page = String(merged.page);
    setParams(out);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <FilterTabs<Actor> label="Cancelled by" options={[undefined, "CUSTOMER", "DRIVER", "ADMIN"]} value={cancelledBy} onChange={(by) => update({ by })} render={(value) => (value ? titleCase(value) : "Anyone")} />
          <FilterTabs<FeeStatus> label="Fee" options={[undefined, "DUE", "WAIVED", "COLLECTED"]} value={feeStatus} onChange={(value) => update({ feeStatus: value })} render={(value) => (value ? `Fee ${titleCase(value).toLowerCase()}` : "Any fee")} />
        </div>
        <SearchBox value={search} onChange={(q) => update({ q })} placeholder="Ride code" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No cancellations match.">
          {data && (
            <>
              <Table head={["Ride", "By", "Reason", "Ride state", "Fee", "When", ""]}>
                {data.items.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className={cell}>
                      <Link to={`/rides/${record.rideId}`} className="font-mono font-semibold text-bhagwa-600 hover:underline">
                        {record.rideCode}
                      </Link>
                      <span className="block text-xs text-slate-500">{record.customerName ?? record.customerPhone}</span>
                    </td>
                    <td className={cell}>{titleCase(record.cancelledBy)}</td>
                    <td className={cell}>
                      {record.reasonLabel}
                      {record.note && <span className="block text-xs text-slate-500">“{record.note}”</span>}
                    </td>
                    <td className={`${cell} text-xs`}>{titleCase(record.rideStatusAtCancellation)}</td>
                    <td className={cell}>
                      {record.feeAmount > 0 ? (
                        <>
                          <span className="tabular-nums">{formatMoney(record.feeAmount)}</span> <Pill tone={feeTone(record.feeStatus)}>{titleCase(record.feeStatus)}</Pill>
                          {record.feeResolutionNote && <span className="block text-xs text-slate-500">{record.feeResolutionNote}</span>}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={`${cell} text-slate-500`}>{formatDateTime(record.cancelledAt)}</td>
                    <td className={`${cell} whitespace-nowrap text-right`}>
                      {record.feeStatus === "DUE" && (
                        <span className="flex justify-end gap-3">
                          <button type="button" className="font-semibold text-bhagwa-600 hover:underline" onClick={() => setResolving({ record, status: "WAIVED" })}>
                            Waive
                          </button>
                          <button type="button" className="font-semibold text-emerald-700 hover:underline" onClick={() => setResolving({ record, status: "COLLECTED" })}>
                            Collected
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
              <Pager page={data.page} limit={data.limit} count={data.items.length} total={data.total} hasMore={data.hasMore} fetching={isFetching} onPage={(next) => update({ page: next })} />
            </>
          )}
        </LoadState>
      </section>
      {resolving && (
        <ConfirmDialog
          title={resolving.status === "WAIVED" ? `Waive the ${formatMoney(resolving.record.feeAmount)} fee?` : `Mark ${formatMoney(resolving.record.feeAmount)} as collected?`}
          body={`Ride ${resolving.record.rideCode}. This cannot be undone.`}
          confirmLabel={resolving.status === "WAIVED" ? "Waive fee" : "Mark collected"}
          reasonLabel="Note"
          busy={resolve.isPending}
          error={resolve.error?.message}
          onCancel={() => {
            resolve.reset();
            setResolving(null);
          }}
          onConfirm={(note) => resolve.mutate({ id: resolving.record.id, status: resolving.status, note: note ?? "" }, { onSuccess: () => setResolving(null) })}
        />
      )}
    </div>
  );
}

function Reasons() {
  const { data, error, isPending } = useCancellationReasons();
  const update = useUpdateReason();
  const create = useCreateReason();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ code: "", actor: "CUSTOMER" as Actor, label: "", requiresNote: false });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate(draft, {
      onSuccess: () => {
        setAdding(false);
        setDraft({ code: "", actor: "CUSTOMER", label: "", requiresNote: false });
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <p className="text-sm text-slate-500">Customers and drivers pick from their active reasons. Codes never change; labels can.</p>
        <Button onClick={() => setAdding(true)}>Add reason</Button>
      </div>
      {update.error && <Notice tone="error">{update.error.message}</Notice>}
      <LoadState pending={isPending} error={error}>
        {(["CUSTOMER", "DRIVER", "ADMIN"] as const).map((actor) => (
          <Section key={actor} title={`${titleCase(actor)} reasons`}>
            <ul className="divide-y divide-slate-100">
              {data
                ?.filter((reason) => reason.actor === actor)
                .map((reason) => (
                  <li key={reason.code} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className={`text-sm font-medium ${reason.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>{reason.label}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {reason.code}
                        {reason.requiresNote && " · note required"}
                      </p>
                    </div>
                    <Toggle
                      checked={reason.isActive}
                      label={`${reason.label} active`}
                      disabled={update.isPending}
                      onChange={(isActive) => update.mutate({ actor: reason.actor, code: reason.code, isActive })}
                    />
                  </li>
                ))}
            </ul>
          </Section>
        ))}
      </LoadState>
      {adding && (
        <Modal title="Add a cancellation reason" onClose={() => setAdding(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Who picks it">
                <select value={draft.actor} onChange={(event) => setDraft({ ...draft, actor: event.target.value as Actor })} className={inputClass}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="DRIVER">Driver</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </FormField>
              <FormField label="Code" hint="e.g. LONG_QUEUE (permanent)">
                <input value={draft.code} maxLength={40} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} className={`${inputClass} font-mono`} />
              </FormField>
            </div>
            <FormField label="Label shown in the app">
              <input value={draft.label} maxLength={80} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className={inputClass} />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.requiresNote} onChange={(event) => setDraft({ ...draft, requiresNote: event.target.checked })} />
              Require a short note
            </label>
            {create.error && <Notice tone="error">{create.error.message}</Notice>}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" busy={create.isPending} disabled={draft.code.length < 2 || draft.label.trim().length < 2}>
                Add reason
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Policy() {
  const { data, error, isPending } = useCancellationPolicy();
  const save = useSavePolicy();
  const [draft, setDraft] = useState<Record<keyof Omit<CustomerFeePolicy, "enabled" | "applicableStatuses">, string> & { enabled: boolean; accepted: boolean; arrived: boolean }>();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!data) return;
    const fee = data.current.customerFee;
    setDraft({
      enabled: fee.enabled,
      graceSeconds: String(fee.graceSeconds),
      fixedFee: String(fee.fixedFee),
      percentOfFare: String(fee.percentOfFare),
      maxFee: String(fee.maxFee),
      accepted: fee.applicableStatuses.includes("DRIVER_ACCEPTED"),
      arrived: fee.applicableStatuses.includes("DRIVER_ARRIVED"),
    });
  }, [data]);

  const policy: CustomerFeePolicy | null = draft
    ? {
        enabled: draft.enabled,
        graceSeconds: Number(draft.graceSeconds),
        fixedFee: Number(draft.fixedFee),
        percentOfFare: Number(draft.percentOfFare),
        maxFee: Number(draft.maxFee),
        applicableStatuses: [...(draft.accepted ? ["DRIVER_ACCEPTED" as const] : []), ...(draft.arrived ? ["DRIVER_ARRIVED" as const] : [])],
      }
    : null;
  const invalid =
    !policy ||
    !Number.isInteger(policy.graceSeconds) ||
    policy.graceSeconds < 0 ||
    policy.graceSeconds > 3600 ||
    [policy.fixedFee, policy.percentOfFare, policy.maxFee].some((value) => !Number.isFinite(value) || value < 0) ||
    policy.percentOfFare > 100;
  const sampleFare = 150;
  const sample = policy && !invalid ? Math.min(policy.maxFee > 0 ? policy.maxFee : Infinity, sampleFare, Math.round(policy.fixedFee + (sampleFare * policy.percentOfFare) / 100)) : 0;

  return (
    <LoadState pending={isPending} error={error}>
      {data && draft && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Section title={`Customer cancellation fee — policy v${data.current.version}`} className="lg:col-span-2">
            <div className="space-y-4">
              <Notice tone="warning">
                Fee amounts and timing are a business decision. The seeded policy charges nothing; set values only once they are approved.
              </Notice>
              <label className="flex items-center gap-3 text-sm font-medium">
                <Toggle checked={draft.enabled} label="Charge a cancellation fee" onChange={(enabled) => setDraft({ ...draft, enabled })} />
                Charge customers who cancel after a driver has committed
              </label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <FormField label="Free window (sec)" hint="After the driver accepts">
                  <input inputMode="numeric" value={draft.graceSeconds} onChange={(event) => setDraft({ ...draft, graceSeconds: event.target.value })} className={inputClass} />
                </FormField>
                <FormField label="Flat part (₹)">
                  <input inputMode="decimal" value={draft.fixedFee} onChange={(event) => setDraft({ ...draft, fixedFee: event.target.value })} className={inputClass} />
                </FormField>
                <FormField label="% of fare">
                  <input inputMode="decimal" value={draft.percentOfFare} onChange={(event) => setDraft({ ...draft, percentOfFare: event.target.value })} className={inputClass} />
                </FormField>
                <FormField label="Cap (₹)" hint="0 = fare is the cap">
                  <input inputMode="decimal" value={draft.maxFee} onChange={(event) => setDraft({ ...draft, maxFee: event.target.value })} className={inputClass} />
                </FormField>
              </div>
              <fieldset className="flex flex-wrap gap-4 text-sm">
                <legend className="mb-1 font-medium text-slate-800">Applies when the ride is</legend>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={draft.accepted} onChange={(event) => setDraft({ ...draft, accepted: event.target.checked })} /> Driver on the way
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={draft.arrived} onChange={(event) => setDraft({ ...draft, arrived: event.target.checked })} /> Driver arrived
                </label>
              </fieldset>
              <p className="text-sm text-slate-600">
                Example on a {formatMoney(sampleFare)} fare: {draft.enabled ? <strong>{formatMoney(sample)}</strong> : "no fee"}. Drivers and admins are never charged; the fee is recorded as due and can be waived.
              </p>
              {invalid && <Notice tone="error">Check the values: whole seconds up to 3600, amounts ≥ 0, percentage ≤ 100.</Notice>}
              <div className="flex justify-end">
                <Button disabled={invalid} onClick={() => setConfirming(true)}>
                  Save as new version
                </Button>
              </div>
            </div>
          </Section>
          <Section title="History">
            <ul className="space-y-3 text-sm">
              {data.history.map((entry) => (
                <li key={entry.version}>
                  <p className="font-semibold">
                    v{entry.version} {entry.customerFee.enabled ? <Pill tone="amber">Fee on</Pill> : <Pill>No fee</Pill>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(entry.createdAt)} · {entry.note}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
          {confirming && policy && (
            <ConfirmDialog
              title="Save the cancellation fee policy?"
              body="It applies to cancellations from now on. Past cancellations keep the fee they were charged."
              confirmLabel="Save policy"
              reasonLabel="Why is the policy changing?"
              busy={save.isPending}
              error={save.error?.message}
              onCancel={() => {
                save.reset();
                setConfirming(false);
              }}
              onConfirm={(note) => save.mutate({ customerFee: policy, note: note ?? "" }, { onSuccess: () => setConfirming(false) })}
            />
          )}
        </div>
      )}
    </LoadState>
  );
}

export function CancellationsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (["records", "reasons", "policy"] as const).find((value) => value === params.get("tab")) ?? "records";
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Cancellations" subtitle="Who cancelled, why, in which state, and what it cost — plus the reasons list and the fee policy" />
      <FilterTabs<Tab>
        label="Section"
        options={["records", "reasons", "policy"]}
        value={tab}
        onChange={(value) => setParams({ tab: value ?? "records" })}
        render={(value) => (value === "records" ? "Records" : value === "reasons" ? "Reasons" : "Fee policy")}
      />
      {tab === "records" && <Records />}
      {tab === "reasons" && <Reasons />}
      {tab === "policy" && <Policy />}
    </div>
  );
}
