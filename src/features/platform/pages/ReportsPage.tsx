import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterTabs, Section } from "@/components/DetailUi";
import { DayColumns, RankedBars } from "@/components/Charts";
import { LoadState, PageHeader, StatCard, Table, cell, inputClass } from "@/components/Ui";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { useReport } from "../api";
import type {
  CancellationsReport,
  CustomersReport,
  DriversReport,
  OverviewReport,
  Preset,
  PromotionsReport,
  RangeQuery,
  RevenueReport,
  RidesReport,
} from "../api";

type Tab = "overview" | "rides" | "revenue" | "drivers" | "customers" | "cancellations" | "promotions";
const TABS: Tab[] = ["overview", "rides", "revenue", "drivers", "customers", "cancellations", "promotions"];
const PRESETS: Preset[] = ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "CUSTOM"];
const money = (value: number) => formatMoney(value);
const count = (value: number) => value.toLocaleString("en-IN");
const shortMoney = (value: number) => (value >= 1000 ? `₹${Math.round(value / 100) / 10}k` : `₹${Math.round(value)}`);

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
}

/** Every chart has the same numbers as a table, for screen readers and exact values. */
function DayTable({ rows, columns }: { rows: Array<Record<string, number | string>>; columns: Array<{ key: string; label: string; money?: boolean }> }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-slate-500">Show as table</summary>
      <Table head={["Day", ...columns.map((column) => column.label)]}>
        {rows.map((row) => (
          <tr key={String(row.date)}>
            <td className={cell}>{String(row.date)}</td>
            {columns.map((column) => (
              <td key={column.key} className={`${cell} tabular-nums`}>
                {column.money ? money(Number(row[column.key])) : count(Number(row[column.key]))}
              </td>
            ))}
          </tr>
        ))}
      </Table>
    </details>
  );
}

function Overview({ range }: { range: RangeQuery }) {
  const { data, error, isPending } = useReport<OverviewReport>("overview", range);
  return (
    <LoadState pending={isPending} error={error}>
      {data && (
        <div className="space-y-6">
          <Grid>
            <StatCard label="Rides requested" value={count(data.rides.requested)} />
            <StatCard label="Completed" value={count(data.rides.completed)} tone="good" />
            <StatCard label="Cancelled" value={count(data.rides.cancelled)} tone="warn" hint={`${data.rides.noDriver} found no driver`} />
            <StatCard label="Active now" value={count(data.rides.activeNow)} tone="brand" to="/rides" />
            <StatCard label="Customers" value={count(data.customers.total)} hint={`${data.customers.new} new in range`} />
            <StatCard label="Approved drivers" value={count(data.drivers.approved)} hint={`${data.drivers.onlineNow} online · ${data.drivers.availableNow} free now`} />
            <StatCard label="Pending KYC" value={count(data.drivers.pendingKyc)} to="/drivers?status=UNDER_REVIEW" />
            <StatCard label="Completed ride value" value={money(data.money.completedRideValue)} />
            <StatCard label="Collected" value={money(data.money.collected)} tone="good" />
            <StatCard label="Driver earnings" value={money(data.money.driverEarnings)} />
            <StatCard label="Platform commission" value={money(data.money.platformCommission)} tone="brand" />
            <StatCard label="Promo discounts" value={money(data.money.promoDiscounts)} hint={`Cancellation fees ${money(data.money.cancellationFees)}`} />
          </Grid>
        </div>
      )}
    </LoadState>
  );
}

function Rides({ range }: { range: RangeQuery }) {
  const { data, error, isPending } = useReport<RidesReport>("rides", range);
  return (
    <LoadState pending={isPending} error={error}>
      {data && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">Rides requested in the range, counted by where they ended up.</p>
          <Grid>
            <StatCard label="Requested" value={count(data.totals.requested)} />
            <StatCard label="Completed" value={count(data.totals.completed)} tone="good" hint={`${data.totals.completionRate}% completion`} />
            <StatCard label="Cancelled" value={count(data.totals.cancelled)} tone="warn" hint={`${data.totals.cancellationRate}% cancellation`} />
            <StatCard label="No driver found" value={count(data.totals.noDriver)} tone="bad" />
            <StatCard label="Still searching / assigned" value={`${data.totals.searching} / ${data.totals.assigned}`} />
            <StatCard label="In progress" value={count(data.totals.inProgress)} />
            <StatCard label="Average fare" value={money(data.averages.fare)} />
            <StatCard label="Average trip" value={`${data.averages.distanceKm} km`} hint={`${data.averages.tripMinutes} min driving · ${data.averages.durationMinutes} min estimated`} />
          </Grid>
          <Section title="Rides per day">
            <DayColumns
              label="Rides requested, completed and cancelled per day"
              rows={data.byDay}
              series={[
                { key: "requested", label: "Requested" },
                { key: "completed", label: "Completed" },
                { key: "cancelled", label: "Cancelled" },
              ]}
            />
            <DayTable rows={data.byDay} columns={[{ key: "requested", label: "Requested" }, { key: "completed", label: "Completed" }, { key: "cancelled", label: "Cancelled" }]} />
          </Section>
          <div className="grid gap-6 lg:grid-cols-2">
            {(["byRideType", "byZone"] as const).map((key) => (
              <Section key={key} title={key === "byRideType" ? "By ride type" : "By pickup zone"}>
                <Table head={["", "Requested", "Completed", "Cancelled", "Value"]}>
                  {data[key].map((row) => (
                    <tr key={row.key}>
                      <td className={`${cell} font-medium`}>{row.label}</td>
                      <td className={`${cell} tabular-nums`}>{row.requested}</td>
                      <td className={`${cell} tabular-nums`}>{row.completed}</td>
                      <td className={`${cell} tabular-nums`}>{row.cancelled}</td>
                      <td className={`${cell} tabular-nums`}>{money(row.completedValue)}</td>
                    </tr>
                  ))}
                </Table>
              </Section>
            ))}
          </div>
        </div>
      )}
    </LoadState>
  );
}

function Revenue({ range }: { range: RangeQuery }) {
  const { data, error, isPending } = useReport<RevenueReport>("revenue", range);
  return (
    <LoadState pending={isPending} error={error}>
      {data && (
        <div className="space-y-6">
          <Grid>
            <StatCard label="Gross booked value" value={money(data.totals.grossBookedValue)} hint="Estimated fare of rides requested" />
            <StatCard label="Completed ride value" value={money(data.totals.completedRideValue)} />
            <StatCard label="Promo discounts" value={money(data.totals.promoDiscounts)} hint="Funded by Tirvona" />
            <StatCard label="Customers owe" value={money(data.totals.customerPayable)} />
            <StatCard label="Collected online" value={money(data.totals.collectedOnline)} tone="good" />
            <StatCard label="Collected in cash" value={money(data.totals.collectedCash)} tone="good" hint="Held by drivers" />
            <StatCard label="Refunds" value={money(data.totals.refunds)} />
            <StatCard label="Unpaid completed rides" value={count(data.totals.unpaidCompletedRides)} tone={data.totals.unpaidCompletedRides ? "warn" : "default"} hint={money(data.totals.unpaidAmount)} to="/payments" />
            <StatCard label="Driver earnings" value={money(data.totals.driverEarnings)} />
            <StatCard label="Platform commission" value={money(data.totals.platformCommission)} tone="brand" />
            <StatCard label="Net platform revenue" value={money(data.totals.platformNetRevenue)} tone="brand" hint="Commission − promo discounts" />
            <StatCard
              label="Cancellation fees"
              value={money(data.totals.cancellationFeesAssessed)}
              hint={`${money(data.totals.cancellationFeesDue)} due · ${money(data.totals.cancellationFeesCollected)} collected · ${money(data.totals.cancellationFeesWaived)} waived`}
              to="/cancellations"
            />
          </Grid>
          <Section title="Money per day">
            <DayColumns
              label="Completed ride value, money collected and commission per day"
              rows={data.byDay}
              format={shortMoney}
              series={[
                { key: "completedValue", label: "Completed value" },
                { key: "collected", label: "Collected" },
                { key: "commission", label: "Commission" },
              ]}
            />
            <DayTable
              rows={data.byDay}
              columns={[
                { key: "completedValue", label: "Completed value", money: true },
                { key: "collected", label: "Collected", money: true },
                { key: "commission", label: "Commission", money: true },
                { key: "discounts", label: "Discounts", money: true },
              ]}
            />
          </Section>
          <p className="text-xs text-slate-500">
            Analytical totals from Tirvona records (payments by paid date, earnings by ride completion). Gateway settlements are reconciled on the Payments page.
          </p>
        </div>
      )}
    </LoadState>
  );
}

function Drivers({ range }: { range: RangeQuery }) {
  const { data, error, isPending } = useReport<DriversReport>("drivers", range);
  return (
    <LoadState pending={isPending} error={error}>
      {data && (
        <div className="space-y-6">
          <Grid>
            <StatCard label="All drivers" value={count(data.totals.total)} />
            <StatCard label="Onboarding / under review" value={`${data.totals.pendingKyc} / ${data.totals.underReview}`} to="/drivers?status=UNDER_REVIEW" />
            <StatCard label="Approved" value={count(data.totals.approved)} tone="good" />
            <StatCard label="Rejected / suspended" value={`${data.totals.rejected} / ${data.totals.suspended}`} tone="bad" />
            <StatCard label="Online now" value={count(data.totals.online)} />
            <StatCard label="Available now" value={count(data.totals.available)} />
            <StatCard label="Drove in range" value={count(data.totals.activeInRange)} />
          </Grid>
          <Section title="Top drivers in range">
            {data.top.length === 0 ? (
              <p className="text-sm text-slate-500">No completed rides in this range.</p>
            ) : (
              <Table head={["Driver", "Completed", "Cancelled by driver", "Ride value", "Net earnings", "Rating"]}>
                {data.top.map((row) => (
                  <tr key={row.driverId}>
                    <td className={cell}>
                      <Link to={`/drivers/${row.driverId}`} className="font-semibold text-bhagwa-600 hover:underline">
                        {row.name}
                      </Link>
                      <span className="block font-mono text-xs text-slate-500">{row.driverCode}</span>
                    </td>
                    <td className={`${cell} tabular-nums`}>{row.completedRides}</td>
                    <td className={`${cell} tabular-nums`}>{row.cancelledRides}</td>
                    <td className={`${cell} tabular-nums`}>{money(row.completedValue)}</td>
                    <td className={`${cell} tabular-nums`}>{money(row.netEarnings)}</td>
                    <td className={`${cell} tabular-nums`}>{row.ratingCount ? `${row.ratingAverage.toFixed(2)} ★ (${row.ratingCount})` : "—"}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </div>
      )}
    </LoadState>
  );
}

function Customers({ range }: { range: RangeQuery }) {
  const { data, error, isPending } = useReport<CustomersReport>("customers", range);
  return (
    <LoadState pending={isPending} error={error}>
      {data && (
        <div className="space-y-6">
          <Grid>
            <StatCard label="All customers" value={count(data.totals.total)} />
            <StatCard label="New in range" value={count(data.totals.new)} tone="good" />
            <StatCard label="Active (booked)" value={count(data.totals.active)} />
            <StatCard label="Blocked" value={count(data.totals.blocked)} tone="bad" to="/customers?status=BLOCKED" />
            <StatCard label="Bookings" value={count(data.totals.bookings)} />
            <StatCard label="Completed rides" value={count(data.totals.completedRides)} />
            <StatCard label="Cancelled rides" value={count(data.totals.cancelledRides)} />
            <StatCard label="Rides per active customer" value={data.totals.averageRidesPerActiveCustomer} />
          </Grid>
          <Section title="Customers per day">
            <DayColumns
              label="New and active customers per day"
              rows={data.byDay}
              series={[
                { key: "newCustomers", label: "New" },
                { key: "activeCustomers", label: "Active" },
              ]}
            />
            <DayTable rows={data.byDay} columns={[{ key: "newCustomers", label: "New" }, { key: "activeCustomers", label: "Active" }]} />
          </Section>
        </div>
      )}
    </LoadState>
  );
}

function Cancellations({ range }: { range: RangeQuery }) {
  const { data, error, isPending } = useReport<CancellationsReport>("cancellations", range);
  return (
    <LoadState pending={isPending} error={error}>
      {data && (
        <div className="space-y-6">
          <Grid>
            <StatCard label="Cancellations" value={count(data.totals.total)} hint={`${data.totals.cancellationRate}% of requests`} />
            <StatCard label="By customers" value={count(data.totals.byCustomer)} />
            <StatCard label="By drivers" value={count(data.totals.byDriver)} tone="warn" />
            <StatCard label="By admins" value={count(data.totals.byAdmin)} />
            <StatCard label="No driver found (system)" value={count(data.totals.noDriverExpiries)} tone="bad" />
            <StatCard label="Fees charged" value={money(data.fees.charged)} hint={`${money(data.fees.due)} still due`} />
            <StatCard label="Fees collected" value={money(data.fees.collected)} tone="good" />
            <StatCard label="Fees waived" value={money(data.fees.waived)} />
          </Grid>
          <Section title="Cancellations per day">
            <DayColumns
              label="Cancellations per day by who cancelled"
              rows={data.byDay}
              series={[
                { key: "customer", label: "Customer" },
                { key: "driver", label: "Driver" },
                { key: "admin", label: "Admin" },
              ]}
            />
            <DayTable rows={data.byDay} columns={[{ key: "customer", label: "Customer" }, { key: "driver", label: "Driver" }, { key: "admin", label: "Admin" }]} />
          </Section>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Reasons">
              <RankedBars rows={data.byReason.map((row) => ({ label: `${row.label} (${titleCase(row.actor)})`, value: row.count }))} />
            </Section>
            <Section title="Ride state when cancelled">
              <RankedBars rows={data.byStatusAtCancellation.map((row) => ({ label: titleCase(row.status), value: row.count }))} />
            </Section>
          </div>
        </div>
      )}
    </LoadState>
  );
}

function Promotions({ range }: { range: RangeQuery }) {
  const { data, error, isPending } = useReport<PromotionsReport>("promotions", range);
  return (
    <LoadState pending={isPending} error={error}>
      {data && (
        <div className="space-y-6">
          <Grid>
            <StatCard label="Promo codes" value={count(data.totals.promos)} hint={`${data.totals.activePromos} active · ${data.totals.liveNow} live now`} to="/promotions" />
            <StatCard label="Applied at booking" value={count(data.totals.applied)} hint={`${data.totals.released} given back on cancellation`} />
            <StatCard label="Redeemed on completed rides" value={count(data.totals.redeemed)} tone="good" />
            <StatCard label="Discount given" value={money(data.totals.discountGiven)} tone="brand" hint={`${data.totals.promoAssistedRides} rides worth ${money(data.totals.promoAssistedValue)}`} />
          </Grid>
          <Section title="Top codes in range">
            {data.top.length === 0 ? (
              <p className="text-sm text-slate-500">No promo usage in this range.</p>
            ) : (
              <Table head={["Code", "Applied", "Redeemed", "Discount"]}>
                {data.top.map((row) => (
                  <tr key={row.code}>
                    <td className={cell}>
                      <span className="font-mono font-semibold">{row.code}</span>
                      <span className="block text-xs text-slate-500">{row.title}</span>
                    </td>
                    <td className={`${cell} tabular-nums`}>{row.applied}</td>
                    <td className={`${cell} tabular-nums`}>{row.redeemed}</td>
                    <td className={`${cell} tabular-nums`}>{money(row.discount)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </div>
      )}
    </LoadState>
  );
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((value) => value === params.get("tab")) ?? "overview";
  const preset = PRESETS.find((value) => value === params.get("preset")) ?? "LAST_7_DAYS";
  const [custom, setCustom] = useState({ from: params.get("from") ?? "", to: params.get("to") ?? "" });
  const range: RangeQuery = preset === "CUSTOM" ? { preset, from: params.get("from") ?? undefined, to: params.get("to") ?? undefined } : { preset };

  function update(next: Partial<{ tab: Tab; preset: Preset; from: string; to: string }>) {
    const merged = { tab, preset, from: params.get("from") ?? "", to: params.get("to") ?? "", ...next };
    const out: Record<string, string> = { tab: merged.tab, preset: merged.preset };
    if (merged.preset === "CUSTOM" && merged.from && merged.to) Object.assign(out, { from: merged.from, to: merged.to });
    setParams(out);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Reports" subtitle={`Aggregated from the live records · days in India time · refreshed ${formatDateTime(new Date().toISOString())}`} />
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs<Preset> label="Date range" options={PRESETS} value={preset} onChange={(value) => update({ preset: value ?? "LAST_7_DAYS" })} render={(value) => titleCase(value ?? "")} />
        {preset === "CUSTOM" && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              update(custom);
            }}
          >
            <input type="date" aria-label="From" value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} className={`${inputClass} w-auto`} />
            <span className="text-sm text-slate-500">to</span>
            <input type="date" aria-label="To" value={custom.to} onChange={(event) => setCustom({ ...custom, to: event.target.value })} className={`${inputClass} w-auto`} />
            <button type="submit" disabled={!custom.from || !custom.to} className="rounded-lg bg-midnight px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
              Apply
            </button>
          </form>
        )}
      </div>
      <FilterTabs<Tab> label="Report" options={TABS} value={tab} onChange={(value) => update({ tab: value ?? "overview" })} render={(value) => titleCase(value ?? "")} />
      {preset === "CUSTOM" && !range.from ? (
        <p className="text-sm text-slate-500">Pick a start and end date, then Apply.</p>
      ) : (
        <>
          {tab === "overview" && <Overview range={range} />}
          {tab === "rides" && <Rides range={range} />}
          {tab === "revenue" && <Revenue range={range} />}
          {tab === "drivers" && <Drivers range={range} />}
          {tab === "customers" && <Customers range={range} />}
          {tab === "cancellations" && <Cancellations range={range} />}
          {tab === "promotions" && <Promotions range={range} />}
        </>
      )}
    </div>
  );
}
