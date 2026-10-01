import { useState } from "react";
import type { FormEvent } from "react";
import { Megaphone, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { FilterTabs, Pager } from "@/components/DetailUi";
import { Button, ConfirmDialog, FormField, LoadState, Modal, Notice, PageHeader, Pill, inputClass } from "@/components/Ui";
import { formatDateTime, titleCase } from "@/lib/format";
import { AUDIENCES, DEEP_LINKS, useAudienceSize, useBroadcastAction, useBroadcasts, useSaveBroadcast } from "../api";
import type { Audience, Broadcast, BroadcastStatus, DeepLink } from "../api";

const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL_CUSTOMERS: "All customers",
  ALL_DRIVERS: "All drivers",
  APPROVED_DRIVERS: "Approved drivers",
  ALL_USERS: "All customers and drivers",
};

const statusTone = (status: BroadcastStatus) =>
  ({ DRAFT: "slate", SCHEDULED: "blue", SENDING: "amber", SENT: "green", CANCELLED: "slate", FAILED: "red" })[status] as "slate" | "blue" | "amber" | "green" | "red";

const toLocalInput = (iso?: string) => {
  const date = iso ? new Date(iso) : new Date(Date.now() + 3_600_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function Composer({ broadcast, onClose }: { broadcast?: Broadcast; onClose: () => void }) {
  const save = useSaveBroadcast();
  const [form, setForm] = useState({
    title: broadcast?.title ?? "",
    message: broadcast?.message ?? "",
    audience: broadcast?.audience ?? ("ALL_CUSTOMERS" as Audience),
    deepLink: broadcast?.deepLink ?? ("NONE" as DeepLink),
    schedule: Boolean(broadcast?.scheduledAt),
    scheduledAt: toLocalInput(broadcast?.scheduledAt),
  });
  const audience = useAudienceSize(form.audience);
  const valid = form.title.trim().length >= 3 && form.message.trim().length >= 3;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    save.mutate(
      {
        id: broadcast?.id,
        title: form.title.trim(),
        message: form.message.trim(),
        audience: form.audience,
        deepLink: form.deepLink,
        scheduledAt: form.schedule ? new Date(form.scheduledAt).toISOString() : broadcast ? null : undefined,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal title={broadcast ? "Edit broadcast" : "New broadcast"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Title" hint={`${form.title.length}/120 — the notification headline`}>
          <input value={form.title} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} />
        </FormField>
        <FormField label="Message" hint={`${form.message.length}/500`}>
          <textarea rows={4} value={form.message} maxLength={500} onChange={(event) => setForm({ ...form, message: event.target.value })} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Audience" hint={audience.data ? `${audience.data.recipients.toLocaleString("en-IN")} accounts right now (blocked excluded)` : "Counting…"}>
            <select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value as Audience })} className={inputClass}>
              {AUDIENCES.map((value) => (
                <option key={value} value={value}>
                  {AUDIENCE_LABEL[value]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tapping opens">
            <select value={form.deepLink} onChange={(event) => setForm({ ...form, deepLink: event.target.value as DeepLink })} className={inputClass}>
              {DEEP_LINKS.map((value) => (
                <option key={value} value={value}>
                  {value === "NONE" ? "Notification centre only" : titleCase(value)}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.schedule} onChange={(event) => setForm({ ...form, schedule: event.target.checked })} />
          Schedule for later (otherwise saved as a draft to send when ready)
        </label>
        {form.schedule && (
          <FormField label="Send at">
            <input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} className={inputClass} />
          </FormField>
        )}
        {save.error && <Notice tone="error">{save.error.message}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={save.isPending} disabled={!valid}>
            {form.schedule ? "Schedule" : "Save draft"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function BroadcastsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const status = (["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED", "FAILED"] as const).find((value) => value === params.get("status"));
  const { data, error, isPending, isFetching } = useBroadcasts({ page, status });
  const action = useBroadcastAction();
  const [composing, setComposing] = useState<Broadcast | "new" | null>(params.get("new") === "1" ? "new" : null);
  const [confirm, setConfirm] = useState<{ broadcast: Broadcast; action: "send" | "cancel" } | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Broadcasts"
        subtitle="Announcements sent by operations. Ride, payment and safety notifications are sent automatically by the system and are not managed here."
        actions={
          <Button onClick={() => setComposing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> New broadcast
          </Button>
        }
      />
      <FilterTabs<BroadcastStatus>
        label="Status"
        options={[undefined, "DRAFT", "SCHEDULED", "SENT", "CANCELLED", "FAILED"]}
        value={status}
        onChange={(value) => setParams(value ? { status: value } : {})}
        render={(value) => (value ? titleCase(value) : "History")}
      />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No broadcasts here.">
          {data && (
            <>
              <ul className="divide-y divide-slate-100">
                {data.items.map((broadcast) => (
                  <li key={broadcast.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                    <Megaphone className="mt-1 h-5 w-5 shrink-0 text-bhagwa-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                        {broadcast.title} <Pill tone={statusTone(broadcast.status)}>{titleCase(broadcast.status)}</Pill>
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">{broadcast.message}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {AUDIENCE_LABEL[broadcast.audience]}
                        {broadcast.deepLink !== "NONE" && ` · opens ${titleCase(broadcast.deepLink)}`}
                        {broadcast.scheduledAt && broadcast.status === "SCHEDULED" && ` · sends ${formatDateTime(broadcast.scheduledAt)}`}
                        {broadcast.sentAt && ` · sent ${formatDateTime(broadcast.sentAt)} to ${broadcast.processedCount}`}
                        {broadcast.status === "SENDING" && ` · ${broadcast.processedCount} so far`}
                        {` · by ${broadcast.createdByName ?? "admin"} ${formatDateTime(broadcast.createdAt)}`}
                      </p>
                      {broadcast.error && <p className="mt-1 text-xs text-red-600">{broadcast.error}</p>}
                    </div>
                    {(broadcast.status === "DRAFT" || broadcast.status === "SCHEDULED") && (
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setComposing(broadcast)}>
                          Edit
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirm({ broadcast, action: "cancel" })}>
                          Cancel
                        </Button>
                        <Button onClick={() => setConfirm({ broadcast, action: "send" })}>Send now</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Pager page={data.page} limit={data.limit} count={data.items.length} total={data.total} hasMore={data.hasMore} fetching={isFetching} onPage={(next) => setParams({ ...(status ? { status } : {}), page: String(next) })} />
            </>
          )}
        </LoadState>
      </section>
      {composing && <Composer broadcast={composing === "new" ? undefined : composing} onClose={() => setComposing(null)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.action === "send" ? `Send “${confirm.broadcast.title}” now?` : "Cancel this broadcast?"}
          body={
            confirm.action === "send"
              ? `It goes to ${AUDIENCE_LABEL[confirm.broadcast.audience].toLowerCase()} as an in-app notification and a push. This cannot be recalled.`
              : "It will not be sent. You can create a new one later."
          }
          confirmLabel={confirm.action === "send" ? "Send broadcast" : "Cancel broadcast"}
          danger={confirm.action === "cancel"}
          busy={action.isPending}
          error={action.error?.message}
          onCancel={() => {
            action.reset();
            setConfirm(null);
          }}
          onConfirm={() => action.mutate({ id: confirm.broadcast.id, action: confirm.action }, { onSuccess: () => setConfirm(null) })}
        />
      )}
    </div>
  );
}
