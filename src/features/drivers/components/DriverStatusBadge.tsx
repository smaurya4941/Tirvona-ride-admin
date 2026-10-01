import type { DocumentStatus, DriverStatus } from "../api/drivers";

const styles: Record<DriverStatus | DocumentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  VERIFIED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function DriverStatusBadge({ status }: { status: DriverStatus | DocumentStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {statusLabel(status)}
    </span>
  );
}
