import { Check, Circle, CircleDot, SkipForward } from "lucide-react";
import { formatKm } from "@/lib/format";
import { formatDuration } from "../api";
import type { CircuitView, StopStatus } from "../api";

const STOP_STYLE: Record<StopStatus, { label: string; className: string }> = {
  UPCOMING: { label: "Upcoming", className: "text-slate-400" },
  ARRIVING: { label: "Heading there", className: "text-bhagwa-600" },
  ARRIVED: { label: "Arrived", className: "text-sky-700" },
  WAITING: { label: "Visiting", className: "text-sky-700" },
  COMPLETED: { label: "Done", className: "text-emerald-700" },
  SKIPPED: { label: "Skipped", className: "text-red-600" },
};

function StopIcon({ status }: { status: StopStatus }) {
  if (status === "COMPLETED") return <Check className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (status === "SKIPPED") return <SkipForward className="h-4 w-4 text-red-500" aria-hidden />;
  if (status === "UPCOMING") return <Circle className="h-4 w-4 text-slate-300" aria-hidden />;
  return <CircleDot className="h-4 w-4 text-bhagwa-500" aria-hidden />;
}

/** Pickup → ✓ stop → ● current → ○ next, as the spec draws it. */
export function StopTimeline({ circuit, pickup }: { circuit: CircuitView; pickup: string }) {
  return (
    <ol className="space-y-2">
      <li className="flex items-center gap-3 text-sm text-slate-600">
        <Check className="h-4 w-4 text-slate-400" aria-hidden /> <span className="truncate">Pickup · {pickup}</span>
      </li>
      {circuit.stops.map((stop) => {
        const style = STOP_STYLE[stop.status];
        const blocked = circuit.exception?.stopOrder === stop.order;
        return (
          <li key={stop.order} className={`flex items-start gap-3 rounded-lg px-2 py-1.5 ${circuit.currentStop?.order === stop.order ? "bg-bhagwa-50" : ""}`}>
            <span className="mt-0.5">
              <StopIcon status={stop.status} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900">
                {stop.order}. {stop.name}
              </span>
              <span className={`block text-xs ${style.className}`}>
                {style.label}
                {stop.arrivedAt && ` · arrived ${new Date(stop.arrivedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                {stop.completedAt && ` · left ${new Date(stop.completedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
              </span>
              {blocked && <span className="mt-0.5 block text-xs font-semibold text-red-600">Reported blocked{circuit.exception?.note ? `: ${circuit.exception.note}` : ""}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "2h 14m / 5h" with a bar that turns amber near the end and red past it. */
export function UsageBar({ label, used, included, format }: { label: string; used: number; included: number; format: (value: number) => string }) {
  const ratio = included > 0 ? used / included : 0;
  const tone = ratio >= 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-900">
          {format(used)} / {format(included)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

export function CircuitUsage({ circuit }: { circuit: CircuitView }) {
  return (
    <div className="space-y-3">
      <UsageBar label="Time" used={circuit.usage.elapsedSeconds} included={circuit.pricing.includedDurationSeconds} format={formatDuration} />
      <UsageBar label="Distance" used={circuit.usage.distanceMeters} included={circuit.pricing.includedDistanceMeters} format={(value) => formatKm(value)} />
      {!circuit.usage.distanceReliable && <p className="text-xs text-amber-700">GPS trail is patchy right now; distance may be under-counted.</p>}
    </div>
  );
}
