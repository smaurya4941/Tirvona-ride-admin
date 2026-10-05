import { useState } from "react";
import { Link } from "react-router-dom";
import { Section } from "@/components/DetailUi";
import { RankedBars } from "@/components/Charts";
import { LoadState, PageHeader, StatCard, Table, cell, inputClass } from "@/components/Ui";
import { formatKm, formatMoney } from "@/lib/format";
import { formatDuration, useCircuitReport } from "../api";

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function CircuitReportsPage() {
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const range = {
    startDate: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    endDate: to ? new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString() : undefined,
  };
  const { data, error, isPending } = useCircuitReport(range);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Circuit reports"
        subtitle="Bookings, revenue and package performance for circuits booked in the range."
        actions={
          <div className="flex items-end gap-2">
            <label className="text-xs text-slate-500">
              From
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${inputClass} mt-0.5 w-auto`} />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={`${inputClass} mt-0.5 w-auto`} />
            </label>
          </div>
        }
      />
      <LoadState pending={isPending} error={error}>
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <StatCard label="Circuit bookings" value={data.bookings.total} />
              <StatCard label="Completed" value={data.bookings.completed} tone="good" />
              <StatCard label="Cancelled" value={data.bookings.cancelled} tone="warn" />
              <StatCard label="No driver" value={data.bookings.noDriver} tone="bad" />
              <StatCard label="Active now" value={data.bookings.active} tone="brand" />
              <StatCard label="Payment pending" value={data.bookings.paymentPending} tone={data.bookings.paymentPending ? "bad" : "default"} to="/circuits/bookings" />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Revenue (completed circuits)">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Gross" value={formatMoney(data.revenue.gross)} tone="brand" />
                  <StatCard label="Package revenue" value={formatMoney(data.revenue.packageRevenue)} />
                  <StatCard label="Extra distance" value={formatMoney(data.revenue.extraDistanceRevenue)} />
                  <StatCard label="Extra time" value={formatMoney(data.revenue.extraTimeRevenue)} />
                  <StatCard label="Discounts" value={formatMoney(data.revenue.discounts)} />
                  <StatCard label="Refunds" value={formatMoney(data.revenue.refunds)} />
                </div>
              </Section>
              <Section title="Operations">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Average duration" value={formatDuration(data.operations.averageDurationSeconds)} />
                  <StatCard label="Average distance" value={formatKm(data.operations.averageDistanceMeters)} />
                  <StatCard label="Average stops completed" value={data.operations.averageStopsCompleted} />
                  <StatCard label="Stops completed" value={data.operations.completedStopsTotal} />
                </div>
              </Section>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Most booked">
                <RankedBars rows={data.packages.slice(0, 8).map((row) => ({ label: row.name, value: row.bookings, hint: row.code }))} />
              </Section>
              <Section title="Highest revenue">
                <RankedBars
                  rows={[...data.packages].sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((row) => ({ label: row.name, value: row.revenue, hint: row.code }))}
                  format={(value) => formatMoney(value)}
                />
              </Section>
            </div>
            <Section title="Package performance">
              <Table head={["Package", "City", "Bookings", "Completed", "Cancelled", "Cancel rate", "Revenue", "Avg duration", "Avg distance"]}>
                {data.packages.map((row) => (
                  <tr key={row.packageId}>
                    <td className={cell}>
                      <Link to={`/circuits/packages/${row.packageId}`} className="font-medium text-slate-900 hover:underline">
                        {row.name}
                      </Link>
                      <p className="font-mono text-[11px] text-slate-500">{row.code}</p>
                    </td>
                    <td className={cell}>{row.city}</td>
                    <td className={`${cell} tabular-nums`}>{row.bookings}</td>
                    <td className={`${cell} tabular-nums`}>{row.completed}</td>
                    <td className={`${cell} tabular-nums`}>{row.cancelled}</td>
                    <td className={`${cell} tabular-nums`}>{row.bookings ? `${Math.round((row.cancelled / row.bookings) * 100)}%` : "—"}</td>
                    <td className={`${cell} tabular-nums font-semibold`}>{formatMoney(row.revenue)}</td>
                    <td className={`${cell} tabular-nums`}>{formatDuration(row.averageDurationSeconds)}</td>
                    <td className={`${cell} tabular-nums`}>{formatKm(row.averageDistanceMeters)}</td>
                  </tr>
                ))}
              </Table>
            </Section>
          </>
        )}
      </LoadState>
    </div>
  );
}
