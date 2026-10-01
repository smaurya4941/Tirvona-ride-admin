import { titleCase } from "@/lib/format";
import type { RideStatus } from "../api/rides";

const styles: Record<RideStatus, string> = {
  SEARCHING: "bg-sky-100 text-sky-800",
  DRIVER_ASSIGNED: "bg-indigo-100 text-indigo-800",
  DRIVER_ACCEPTED: "bg-violet-100 text-violet-800",
  DRIVER_ARRIVED: "bg-amber-100 text-amber-800",
  RIDE_STARTED: "bg-bhagwa-100 text-bhagwa-600",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  NO_DRIVER_AVAILABLE: "bg-red-100 text-red-700",
};

export function RideStatusBadge({ status }: { status: RideStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {titleCase(status)}
    </span>
  );
}
