import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { formatDateTime, formatMoney } from "@/lib/format";
import { StatCard } from "@/features/payments/components/PaymentBadges";
import { useDriverEarningsList, useEarningsTotals } from "../api/earnings";

export function EarningsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const search = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);

  const totals = useEarningsTotals();
  const { data, error, isPending, isFetching } = useDriverEarningsList(page, search);

  function go(next: { page?: number; q?: string }) {
    const merged = { page: 1, q: search, ...next };
    const params: Record<string, string> = {};
    if (merged.q) params.q = merged.q;
    if (merged.page > 1) params.page = String(merged.page);
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-midnight">Driver earnings</h1>
          <p className="text-sm text-slate-500">Ledger of paid rides, commission and manual payouts</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            go({ q: draft.trim() });
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Driver code, name or phone"
            aria-label="Search drivers"
            className="w-72 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
          />
        </form>
      </header>

      {totals.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard label="Gross fares" value={formatMoney(totals.data.gross)} hint={`${totals.data.rides} paid rides`} />
          <StatCard label="Commission" value={formatMoney(totals.data.commission)} />
          <StatCard label="Driver earnings" value={formatMoney(totals.data.net)} hint={`${totals.data.drivers} drivers`} />
          <StatCard label="Available to pay" value={formatMoney(totals.data.available)} hint={`${formatMoney(totals.data.pending)} pending`} />
          <StatCard label="Paid out" value={formatMoney(totals.data.paid)} />
          <StatCard
            label="Cash commission due"
            value={formatMoney(totals.data.commissionDue)}
            hint={`Drivers kept ${formatMoney(totals.data.collected)} of cash fares`}
          />
        </div>
      )}

      <section className="overflow-hidden rounded-xl shadow-sm border border-slate-200 bg-white">
        {isPending ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading earnings…
          </p>
        ) : error ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-red-600">
            <XCircle className="h-4 w-4" aria-hidden /> {error.message}
          </p>
        ) : data.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No driver has earnings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 text-right font-medium">Rides</th>
                  <th className="px-5 py-3 text-right font-medium">Gross</th>
                  <th className="px-5 py-3 text-right font-medium">Commission</th>
                  <th className="px-5 py-3 text-right font-medium">Net</th>
                  <th className="px-5 py-3 text-right font-medium">Pending</th>
                  <th className="px-5 py-3 text-right font-medium">Available</th>
                  <th className="px-5 py-3 text-right font-medium">Paid</th>
                  <th className="px-5 py-3 font-medium">Last ride</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((row) => (
                  <tr key={row.driver.driverId} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/earnings/${row.driver.driverId}`} className="font-medium text-bhagwa-600 hover:underline">
                        {row.driver.name}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">
                        {row.driver.driverCode} · {row.driver.phone}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right">{row.rides}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(row.gross)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{formatMoney(row.commission)}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatMoney(row.net)}</td>
                    <td className="px-5 py-3 text-right text-amber-700">{formatMoney(row.pending)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-sky-700">{formatMoney(row.available)}</td>
                    <td className="px-5 py-3 text-right text-emerald-700">{formatMoney(row.paid)}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{formatDateTime(row.lastEarningAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && (
          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              {(data.page - 1) * data.limit + 1}–{(data.page - 1) * data.limit + data.items.length} of {data.total}
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="Refreshing" />}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => go({ page: page - 1 })}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
              </button>
              <button
                type="button"
                disabled={!data.hasMore}
                onClick={() => go({ page: page + 1 })}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </span>
          </footer>
        )}
      </section>
    </div>
  );
}
