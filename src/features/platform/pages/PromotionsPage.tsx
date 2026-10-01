import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Field, FilterTabs, Pager, Section } from "@/components/DetailUi";
import { Button, ConfirmDialog, FormField, LoadState, Modal, Notice, PageHeader, Pill, SearchBox, StatCard, Table, cell, inputClass } from "@/components/Ui";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { usePromo, usePromos, useRideTypes, useSavePromo, useSetPromoStatus } from "../api";
import type { DiscountType, Promo, PromoInput } from "../api";

type Window = "LIVE" | "SCHEDULED" | "EXPIRED";

export function describeDiscount(promo: Pick<Promo, "discountType" | "discountValue" | "maxDiscount">): string {
  return promo.discountType === "PERCENTAGE"
    ? `${promo.discountValue}% off${promo.maxDiscount ? ` (up to ${formatMoney(promo.maxDiscount)})` : ""}`
    : `${formatMoney(promo.discountValue)} off`;
}

function PromoState({ promo }: { promo: Promo }) {
  const now = Date.now();
  if (promo.status === "INACTIVE") return <Pill>Inactive</Pill>;
  if (new Date(promo.endsAt).getTime() <= now) return <Pill tone="red">Expired</Pill>;
  if (new Date(promo.startsAt).getTime() > now) return <Pill tone="blue">Scheduled</Pill>;
  if (promo.usageLimit !== undefined && promo.usedCount >= promo.usageLimit) return <Pill tone="amber">Used up</Pill>;
  return <Pill tone="green">Live</Pill>;
}

const toLocalInput = (iso?: string) => {
  const date = iso ? new Date(iso) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function PromoForm({ promo, onClose }: { promo?: Promo; onClose: () => void }) {
  const save = useSavePromo();
  const rideTypes = useRideTypes();
  const [form, setForm] = useState({
    code: promo?.code ?? "",
    title: promo?.title ?? "",
    description: promo?.description ?? "",
    discountType: (promo?.discountType ?? "FLAT") as DiscountType,
    discountValue: String(promo?.discountValue ?? ""),
    maxDiscount: promo?.maxDiscount !== undefined ? String(promo.maxDiscount) : "",
    minRideValue: promo?.minRideValue !== undefined ? String(promo.minRideValue) : "",
    usageLimit: promo?.usageLimit !== undefined ? String(promo.usageLimit) : "",
    perUserLimit: String(promo?.perUserLimit ?? 1),
    startsAt: toLocalInput(promo?.startsAt),
    endsAt: toLocalInput(promo?.endsAt ?? new Date(Date.now() + 30 * 86_400_000).toISOString()),
    applicableRideTypes: promo?.applicableRideTypes ?? [],
    showInApp: promo?.showInApp ?? false,
  });
  const [error, setError] = useState<string | null>(null);

  const optional = (value: string) => (value.trim() === "" ? null : Number(value));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!promo && !/^[A-Z0-9]{3,20}$/.test(form.code)) return setError("Code: 3–20 letters or digits");
    if (form.title.trim().length < 3) return setError("Title: at least 3 characters");
    const value = Number(form.discountValue);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter the discount value");
    if (form.discountType === "PERCENTAGE" && value > 100) return setError("A percentage cannot exceed 100");
    const numbers = [optional(form.maxDiscount), optional(form.minRideValue), optional(form.usageLimit), Number(form.perUserLimit)];
    if (numbers.some((entry) => entry !== null && (!Number.isFinite(entry) || entry < 0))) return setError("Limits and amounts must be positive numbers");
    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (!(endsAt > startsAt)) return setError("The end must be after the start");
    const input: PromoInput = {
      code: promo ? undefined : form.code,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue: value,
      maxDiscount: optional(form.maxDiscount),
      minRideValue: optional(form.minRideValue),
      usageLimit: optional(form.usageLimit),
      perUserLimit: Number(form.perUserLimit),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      applicableRideTypes: form.applicableRideTypes,
      showInApp: form.showInApp,
    };
    if (!promo) for (const key of ["maxDiscount", "minRideValue", "usageLimit"] as const) if (input[key] === null) delete input[key];
    save.mutate({ id: promo?.id, input }, { onSuccess: onClose });
  }

  return (
    <Modal title={promo ? `Edit ${promo.code}` : "New promo code"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Code" hint={promo ? "Codes cannot change" : "Customers type this"}>
            <input value={form.code} disabled={Boolean(promo)} maxLength={20} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} className={`${inputClass} font-mono`} />
          </FormField>
          <FormField label="Title">
            <input value={form.title} maxLength={80} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Description (optional)">
          <input value={form.description} maxLength={300} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Discount type">
            <select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value as DiscountType })} className={inputClass}>
              <option value="FLAT">Flat ₹</option>
              <option value="PERCENTAGE">Percentage</option>
            </select>
          </FormField>
          <FormField label={form.discountType === "FLAT" ? "Amount (₹)" : "Percent"}>
            <input inputMode="decimal" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Max discount (₹)" hint="Optional cap">
            <input inputMode="decimal" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })} className={inputClass} />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Min fare (₹)" hint="Optional">
            <input inputMode="decimal" value={form.minRideValue} onChange={(event) => setForm({ ...form, minRideValue: event.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Total uses" hint="Blank = unlimited">
            <input inputMode="numeric" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Uses per customer">
            <input inputMode="numeric" value={form.perUserLimit} onChange={(event) => setForm({ ...form, perUserLimit: event.target.value })} className={inputClass} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Starts">
            <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className={inputClass} />
          </FormField>
          <FormField label="Ends">
            <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className={inputClass} />
          </FormField>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Ride types (none selected = all)</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {rideTypes.data?.map(({ rideType }) => (
              <label key={rideType.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.applicableRideTypes.includes(rideType.code)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      applicableRideTypes: event.target.checked
                        ? [...form.applicableRideTypes, rideType.code]
                        : form.applicableRideTypes.filter((code) => code !== rideType.code),
                    })
                  }
                />
                {rideType.displayName}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.showInApp} onChange={(event) => setForm({ ...form, showInApp: event.target.checked })} />
          List in the customer app's offers (unlisted codes still work when typed)
        </label>
        <p className="text-xs text-slate-500">Discounts are funded by Tirvona: drivers earn on the full fare. A customer always pays at least ₹1.</p>
        {(error || save.error) && <Notice tone="error">{error ?? save.error?.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={save.isPending}>
            {promo ? "Save" : "Create promo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PromotionsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("q") ?? "";
  const validity = (["LIVE", "SCHEDULED", "EXPIRED"] as const).find((value) => value === params.get("window"));
  const { data, error, isPending, isFetching } = usePromos({ page, search, window: validity });
  const [creating, setCreating] = useState(params.get("new") === "1");

  function update(next: { q?: string; window?: Window; page?: number }) {
    const merged = { q: search, window: validity, page: 1, ...next };
    const out: Record<string, string> = {};
    if (merged.q) out.q = merged.q;
    if (merged.window) out.window = merged.window;
    if (merged.page > 1) out.page = String(merged.page);
    setParams(out);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Promo codes"
        subtitle="Codes are validated and reserved by the server at booking; usage is released if the ride is cancelled."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New promo
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs<Window> label="Validity" options={[undefined, "LIVE", "SCHEDULED", "EXPIRED"]} value={validity} onChange={(value) => update({ window: value })} render={(value) => (value ? titleCase(value) : "All")} />
        <SearchBox value={search} onChange={(q) => update({ q })} placeholder="Code or title" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No promo codes yet.">
          {data && (
            <>
              <Table head={["Code", "Discount", "Used", "Valid", "State", ""]}>
                {data.items.map((promo) => (
                  <tr key={promo.id} className="hover:bg-slate-50">
                    <td className={cell}>
                      <p className="font-mono font-semibold">{promo.code}</p>
                      <p className="text-xs text-slate-500">{promo.title}</p>
                    </td>
                    <td className={cell}>{describeDiscount(promo)}</td>
                    <td className={`${cell} tabular-nums`}>
                      {promo.usedCount}
                      {promo.usageLimit !== undefined && ` / ${promo.usageLimit}`}
                      <span className="block text-xs text-slate-500">{formatMoney(promo.discountGiven)} given</span>
                    </td>
                    <td className={`${cell} text-xs text-slate-600`}>
                      {formatDateTime(promo.startsAt)}
                      <br />→ {formatDateTime(promo.endsAt)}
                    </td>
                    <td className={cell}>
                      <PromoState promo={promo} />
                    </td>
                    <td className={`${cell} text-right`}>
                      <Link to={`/promotions/${promo.id}`} className="font-semibold text-bhagwa-600 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </Table>
              <Pager page={data.page} limit={data.limit} count={data.items.length} total={data.total} hasMore={data.hasMore} fetching={isFetching} onPage={(next) => update({ page: next })} />
            </>
          )}
        </LoadState>
      </section>
      {creating && <PromoForm onClose={() => setCreating(false)} />}
    </div>
  );
}

export function PromoDetailPage() {
  const { id = "" } = useParams();
  const { data, error, isPending } = usePromo(id);
  const setStatus = useSetPromoStatus();
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const promo = data?.promo;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/promotions" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All promo codes
      </Link>
      <LoadState pending={isPending} error={error}>
        {promo && data && (
          <>
            <PageHeader
              title={promo.code}
              subtitle={promo.title}
              actions={
                <>
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button variant={promo.status === "ACTIVE" ? "danger" : "primary"} onClick={() => setToggling(true)}>
                    {promo.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                </>
              }
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="State" value={<PromoState promo={promo} />} />
              <StatCard label="Uses (reserved + redeemed)" value={`${promo.usedCount}${promo.usageLimit !== undefined ? ` / ${promo.usageLimit}` : ""}`} />
              <StatCard label="Redeemed rides" value={promo.redeemedCount} />
              <StatCard label="Discount given" value={formatMoney(promo.discountGiven)} tone="brand" />
            </div>
            <Section title="Rules">
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="Discount" value={describeDiscount(promo)} />
                <Field label="Minimum fare" value={promo.minRideValue !== undefined ? formatMoney(promo.minRideValue) : "None"} />
                <Field label="Per customer" value={`${promo.perUserLimit} use(s)`} />
                <Field label="Starts" value={formatDateTime(promo.startsAt)} />
                <Field label="Ends" value={formatDateTime(promo.endsAt)} />
                <Field label="Ride types" value={promo.applicableRideTypes.length ? promo.applicableRideTypes.join(", ") : "All"} />
                <Field label="Listed in app" value={promo.showInApp ? "Yes" : "No"} />
                <Field label="Description" value={promo.description} />
              </dl>
            </Section>
            <Section title="Recent uses">
              {data.redemptions.length === 0 ? (
                <p className="text-sm text-slate-500">Not used yet.</p>
              ) : (
                <Table head={["Ride", "Type", "Discount", "Status", "When"]}>
                  {data.redemptions.map((use) => (
                    <tr key={use.id}>
                      <td className={cell}>
                        <Link to={`/rides/${use.rideId}`} className="font-semibold text-bhagwa-600 hover:underline">
                          Open ride
                        </Link>
                      </td>
                      <td className={cell}>{use.rideType}</td>
                      <td className={`${cell} tabular-nums`}>{formatMoney(use.discount)}</td>
                      <td className={cell}>
                        <Pill tone={use.status === "REDEEMED" ? "green" : use.status === "RESERVED" ? "blue" : "slate"}>{titleCase(use.status)}</Pill>
                      </td>
                      <td className={`${cell} text-slate-500`}>{formatDateTime(use.createdAt)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>
            {editing && <PromoForm promo={promo} onClose={() => setEditing(false)} />}
            {toggling && (
              <ConfirmDialog
                title={promo.status === "ACTIVE" ? `Deactivate ${promo.code}?` : `Activate ${promo.code}?`}
                body={
                  promo.status === "ACTIVE"
                    ? "Customers can no longer apply it. Rides already booked with it keep their discount."
                    : "Customers can apply it again within its validity window."
                }
                confirmLabel={promo.status === "ACTIVE" ? "Deactivate" : "Activate"}
                danger={promo.status === "ACTIVE"}
                reasonLabel={promo.status === "ACTIVE" ? "Reason" : undefined}
                busy={setStatus.isPending}
                error={setStatus.error?.message}
                onCancel={() => {
                  setStatus.reset();
                  setToggling(false);
                }}
                onConfirm={(reason) =>
                  setStatus.mutate({ id: promo.id, status: promo.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason }, { onSuccess: () => setToggling(false) })
                }
              />
            )}
          </>
        )}
      </LoadState>
    </div>
  );
}
