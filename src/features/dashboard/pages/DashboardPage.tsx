import { BadgeCheck, Map as MapIcon, Megaphone, Tags, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { DayColumns } from "@/components/Charts";
import { FilterTabs, Section } from "@/components/DetailUi";
import { Notice, StatCard, inputClass } from "@/components/Ui";
import { useDashboard } from "@/features/drivers/api/drivers";
import type { DashboardRange } from "@/features/drivers/api/drivers";

import { formatMoney } from "@/lib/format";

const QUICK_ACTIONS: Array<{ label: string; to: string; icon: LucideIcon }> = [
  { label: "Review drivers", to: "/drivers?status=UNDER_REVIEW", icon: BadgeCheck },
  { label: "Create promo", to: "/promotions?new=1", icon: Ticket },
  { label: "Ride types", to: "/ride-types", icon: Tags },
  { label: "Create zone", to: "/zones/new", icon: MapIcon },
  { label: "Broadcast", to: "/broadcasts?new=1", icon: Megaphone },
];

const shortMoney = (value: number) => (value >= 1000 ? `₹${Math.round(value / 100) / 10}k` : `₹${Math.round(value)}`);

type Preset = DashboardRange["preset"];
const PRESETS: Preset[] = ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "CUSTOM"];
const PRESET_LABEL: Record<Preset, string> = {
  TODAY: "Today",
  YESTERDAY: "Yesterday",
  LAST_7_DAYS: "Last 7 days",
  LAST_30_DAYS: "Last 30 days",
  CUSTOM: "Custom",
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** "26 Sep 2026" or "20 Sep 2026 – 26 Sep 2026" (the API's `to` is exclusive). */
function periodText(period: { from: string; to: string; days: number }): string {
  const last = new Date(new Date(period.to).getTime() - 1).toISOString();
  return period.days === 1 ? shortDate(period.from) : `${shortDate(period.from)} – ${shortDate(last)}`;
}

function Heading({ children }: { children: string }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h2>;
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const preset = PRESETS.find((value) => value === params.get("preset")) ?? "TODAY";
  const range: DashboardRange =
    preset === "CUSTOM" ? { preset, from: params.get("from") ?? undefined, to: params.get("to") ?? undefined } : { preset };
  const [custom, setCustom] = useState({ from: params.get("from") ?? "", to: params.get("to") ?? "" });
  const { data, error, isFetching } = useDashboard(range);
  const period = data?.period;
  const label = PRESET_LABEL[preset].toLowerCase();
  // Reports and lists open on the same period.
  const reportRange = preset === "CUSTOM" && range.from && range.to ? `preset=CUSTOM&from=${range.from}&to=${range.to}` : `preset=${preset}`;

  function choose(next: Preset) {
    if (next === "CUSTOM") setParams({ preset: next, ...(custom.from && custom.to ? custom : {}) });
    else setParams(next === "TODAY" ? {} : { preset: next });
  }
  const dash = (value?: number) => (value === undefined ? "—" : value.toLocaleString("en-IN"));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs<Preset> label="Period" options={PRESETS} value={preset} onChange={(value) => choose(value ?? "TODAY")} render={(value) => (value ? PRESET_LABEL[value] : "")} />
          {preset === "CUSTOM" && (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (custom.from && custom.to) setParams({ preset: "CUSTOM", from: custom.from, to: custom.to });
              }}
            >
              <input type="date" aria-label="From" value={custom.from} max={custom.to || undefined} onChange={(event) => setCustom({ ...custom, from: event.target.value })} className={`${inputClass} w-auto`} />
              <span className="text-sm text-slate-500">to</span>
              <input type="date" aria-label="To" value={custom.to} min={custom.from || undefined} onChange={(event) => setCustom({ ...custom, to: event.target.value })} className={`${inputClass} w-auto`} />
              <button type="submit" disabled={!custom.from || !custom.to} className="rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm disabled:opacity-40 hover:bg-slate-800 transition-colors">
                Apply
              </button>
            </form>
          )}
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Loading" />}
        </div>
      </header>
      {preset === "CUSTOM" && !(range.from && range.to) && <p className="text-sm text-slate-500">Pick a start and end date, then Apply.</p>}

      {error && <Notice tone="error">{error.message}</Notice>}

      <section className="space-y-3">
        <Heading>Quick actions</Heading>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
            <Link key={to} to={to} className="group flex items-center gap-2 rounded-md border-2 border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-900 hover:shadow-md">
              <Icon className="h-4 w-4 text-slate-500 transition-colors group-hover:text-slate-900" aria-hidden /> {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Heading>{period ? `${PRESET_LABEL[preset]} · ${periodText(period)}` : PRESET_LABEL[preset]}</Heading>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Rides requested" value={dash(period?.requested)} hint={period ? `${dash(period.cancelled)} cancelled` : undefined} to={`/reports?tab=rides&${reportRange}`} />
          <StatCard label="Completed" value={dash(period?.completed)} tone="good" to="/rides?status=COMPLETED" />
          <StatCard label="Active now" value={dash(data?.rides.activeRides)} tone="brand" to="/rides?status=RIDE_STARTED" />
          <StatCard label="Customers" value={dash(data?.totals.customers)} hint={period ? `${period.newCustomers} new ${preset === "CUSTOM" ? "in period" : label}` : undefined} to="/customers" />
          <StatCard label="Approved drivers" value={dash(data?.totals.approvedDrivers)} to="/drivers?status=APPROVED" />
          <StatCard
            label="Ride value"
            value={period ? formatMoney(period.completedRideValue) : "—"}
            hint={period ? `${formatMoney(period.collected)} collected · ${formatMoney(period.platformCommission)} commission` : undefined}
            to={`/reports?tab=revenue&${reportRange}`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <Heading>Live operations</Heading>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Link
            to="/safety"
            className={`rounded-lg border p-3 shadow-sm transition ${
              data?.safety.unacknowledged ? "border-red-600 bg-red-600 text-white hover:bg-red-700" : "border-slate-200 bg-white hover:border-bhagwa-500"
            }`}
          >
            <p className={`text-xs font-medium ${data?.safety.unacknowledged ? "text-red-50" : "text-slate-500"}`}>SOS alerts</p>
            <p className={`mt-1 text-lg font-semibold leading-none tracking-tight ${data?.safety.unacknowledged ? "" : data?.safety.open ? "text-red-600" : "text-emerald-600"}`}>{dash(data?.safety.open)}</p>
            {!!data?.safety.unacknowledged && <p className="mt-1 text-[10px] font-medium uppercase tracking-wider">{data.safety.unacknowledged} waiting for a response</p>}
          </Link>
          <StatCard label="Searching for driver" value={dash(data?.rides.searching)} to="/rides?status=SEARCHING" />
          <StatCard label="Drivers online" value={dash(data?.rides.driversOnline)} hint={data ? `${data.rides.driversMatchable} matchable (live GPS)` : undefined} />
          <StatCard label="Drivers available" value={dash(data?.rides.driversAvailable)} tone="good" />
          <StatCard label="Pending KYC" value={dash(data?.underReviewDrivers)} tone={data?.underReviewDrivers ? "warn" : "default"} to="/drivers?status=UNDER_REVIEW" />
          <StatCard
            label="Open complaints"
            value={data ? dash(data.support.open + data.support.inReview) : "—"}
            hint={data?.support.urgentOpen ? `${data.support.urgentOpen} urgent` : undefined}
            tone={data?.support.urgentOpen ? "bad" : "default"}
            to="/complaints"
          />
        </div>
      </section>

      <section className="space-y-3">
        <Heading>{period && period.days > 1 ? `Performance — ${periodText(period)}` : "Performance — last 7 days"}</Heading>
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Rides">
            {data ? (
              <DayColumns
                label="Rides requested, completed and cancelled per day"
                rows={data.trend}
                series={[
                  { key: "requested", label: "Requested" },
                  { key: "completed", label: "Completed" },
                  { key: "cancelled", label: "Cancelled" },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">Loading…</p>
            )}
          </Section>
          <Section title="Completed ride value" action={<Link to="/reports?tab=revenue" className="text-sm font-semibold text-bhagwa-600 hover:underline">Revenue report</Link>}>
            {data ? <DayColumns label="Completed ride value per day" rows={data.trend} format={shortMoney} series={[{ key: "revenue", label: "Ride value" }]} /> : <p className="text-sm text-slate-500">Loading…</p>}
          </Section>
        </div>
      </section>




    </div>
  );
}
