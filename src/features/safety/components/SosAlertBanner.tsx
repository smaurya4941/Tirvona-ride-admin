import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { timeAgo } from "@/components/DetailUi";
import { useSosSummary } from "../api/sos";

/**
 * App-wide, can't-miss SOS alert: shown on every admin page while any alert
 * is waiting for acknowledgement. Polls every 10 s (also in background tabs)
 * and flashes the tab title when the count goes up.
 */
export function SosAlertBanner() {
  const { data } = useSosSummary();
  const waiting = data?.unacknowledged ?? 0;
  const previous = useRef(0);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+ SOS\) /, "");
    document.title = waiting > 0 ? `(${waiting} SOS) ${base}` : base;
    if (waiting > previous.current && document.hidden && "Notification" in window && Notification.permission === "granted")
      new Notification("Tirvona — SOS alert", { body: `${waiting} emergency alert(s) waiting for a response.` });
    previous.current = waiting;
  }, [waiting]);

  if (!data || data.open === 0) return null;
  if (waiting === 0)
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 md:px-8">
        {data.open} SOS incident{data.open === 1 ? "" : "s"} being handled.{" "}
        <Link to="/safety" className="font-semibold underline">
          View
        </Link>
      </div>
    );
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 bg-red-600 px-4 py-3 text-white md:px-8">
      <AlertTriangle className="h-5 w-5 animate-pulse" aria-hidden />
      <p className="flex-1 text-sm font-semibold">
        🚨 {waiting} SOS alert{waiting === 1 ? "" : "s"} waiting for a response
        {data.oldestUnacknowledgedAt && <span className="font-normal"> · oldest {timeAgo(data.oldestUnacknowledgedAt)}</span>}
      </p>
      {"Notification" in window && Notification.permission === "default" && (
        <button
          type="button"
          onClick={() => void Notification.requestPermission()}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-50 ring-1 ring-red-300 hover:bg-red-700"
        >
          Enable desktop alerts
        </button>
      )}
      <Link to="/safety" className="rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-red-700 hover:bg-red-50">
        Respond now
      </Link>
    </div>
  );
}
