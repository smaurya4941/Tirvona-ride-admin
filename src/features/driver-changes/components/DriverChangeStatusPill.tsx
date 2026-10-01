import { Pill } from "@/components/Ui";
import type { DriverChangeStatus } from "../api/driverChanges";

const TONES = { PENDING: "amber", APPROVED: "green", REJECTED: "red", WITHDRAWN: "slate" } as const;
const LABELS: Record<DriverChangeStatus, string> = {
  PENDING: "Waiting for review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function DriverChangeStatusPill({ status }: { status: DriverChangeStatus }) {
  return <Pill tone={TONES[status]}>{LABELS[status]}</Pill>;
}
