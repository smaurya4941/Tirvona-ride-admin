import { Link } from "react-router-dom";
import { CalendarClock, ChevronRight, Loader2, Percent, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { useCommissionOverview } from "../api/payments";

/** Commission is set per ride type: one card each, with Edit going to that ride type. */
export function CommissionPage() {
  const { data, error, isPending } = useCommissionOverview();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-midnight">Commission</h1>
        <p className="text-sm text-slate-500">
          Manage commission rates by ride type. Tirvona keeps this share of the final fare and the driver earns the rest. A rate
          change applies to rides finalised after it takes effect; earlier rides keep the rate they had.
        </p>
      </header>

      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : error ? (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" aria-hidden /> {error.message}
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map(({ rideType, current, scheduled }) => (
            <li key={rideType.code}>
              <Link
                to={`/commission/${rideType.code}`}
                className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-bhagwa-500/50 hover:shadow"
                aria-label={`Edit ${rideType.displayName} commission`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bhagwa-100 text-bhagwa-600">
                  <Percent className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-[10rem] flex-1">
                  <p className="flex items-center gap-2 text-base font-semibold text-midnight">
                    {rideType.displayName}
                    {!rideType.isActive && <span className="text-[10px] font-medium uppercase text-slate-400">ride type off</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {current ? (
                      <>
                        Active since {formatDateTime(current.effectiveFrom)} · v{current.version}
                      </>
                    ) : (
                      "No commission configured"
                    )}
                  </p>
                  {scheduled.map((next) => (
                    <p key={next.id} className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-800">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                      Scheduled: {next.value}% from {formatDateTime(next.effectiveFrom)}
                    </p>
                  ))}
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Current commission</p>
                  <p className="text-3xl font-bold text-midnight">{current ? `${current.value}%` : "—"}</p>
                </div>
                <span className="flex items-center gap-1 text-sm font-semibold text-bhagwa-600">
                  Edit <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
