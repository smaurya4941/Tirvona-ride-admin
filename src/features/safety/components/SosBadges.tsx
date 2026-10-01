import { titleCase } from "@/lib/format";
import type { SosStatus } from "../api/sos";

const badge = "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

const styles: Record<SosStatus, string> = {
  TRIGGERED: "bg-red-600 text-white animate-pulse",
  ACKNOWLEDGED: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-700",
};

const labels: Partial<Record<SosStatus, string>> = { TRIGGERED: "Triggered — respond", CANCELLED: "False alarm" };

export function SosStatusBadge({ status }: { status: SosStatus }) {
  return <span className={`${badge} ${styles[status]}`}>{labels[status] ?? titleCase(status)}</span>;
}

export const LOCATION_SOURCE_LABEL = {
  DEVICE: "Phone GPS at the moment of the alert",
  DRIVER_LAST_KNOWN: "Driver's last known position (phone had no GPS fix)",
  RIDE_PICKUP: "Ride pickup point (no live position available)",
} as const;
