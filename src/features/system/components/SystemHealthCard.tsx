import { CheckCircle2, CircleSlash, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useHealth } from "../api/health";
import type { DependencyStatus } from "../api/health";

const dependencyView: Record<DependencyStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  up: { label: "Connected", className: "text-emerald-600", Icon: CheckCircle2 },
  down: { label: "Unreachable", className: "text-red-600", Icon: XCircle },
  disabled: { label: "Not configured", className: "text-slate-500", Icon: CircleSlash },
};

function Row({ label, status }: { label: string; status: DependencyStatus }) {
  const { label: text, className, Icon } = dependencyView[status];
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`flex items-center gap-1.5 text-sm ${className}`}>
        <Icon className="h-4 w-4" aria-hidden />
        {text}
      </span>
    </div>
  );
}

export function SystemHealthCard() {
  const { data, error, isPending, isFetching, refetch } = useHealth();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-midnight">System health</h2>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </header>

      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking the API…
        </p>
      ) : error ? (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" aria-hidden /> {error.message}
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-slate-700">API</span>
            <span className={`text-sm ${data.status === "ready" ? "text-emerald-600" : "text-amber-600"}`}>
              {data.status === "ready" ? `Ready · ${data.environment}` : "Degraded"}
            </span>
          </div>
          <Row label="MongoDB" status={data.checks.database} />
          <Row label="Redis" status={data.checks.redis} />
        </div>
      )}
    </section>
  );
}
