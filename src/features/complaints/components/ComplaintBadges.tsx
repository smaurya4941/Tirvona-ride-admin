import { titleCase } from "@/lib/format";
import type { ComplaintPriority, ComplaintStatus } from "../api/complaints";

const badge = "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

const statusStyles: Record<ComplaintStatus, string> = {
  OPEN: "bg-sky-100 text-sky-800",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-200 text-slate-700",
};

const priorityStyles: Record<ComplaintPriority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-sky-50 text-sky-700",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-600 text-white",
};

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  return <span className={`${badge} ${statusStyles[status]}`}>{titleCase(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  return <span className={`${badge} ${priorityStyles[priority]}`}>{titleCase(priority)}</span>;
}
