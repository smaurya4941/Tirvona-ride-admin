import type { CompletionMode, RideEndInfo } from "../api/rides";

/** What each way of ending a trip means to the person reading it. */
export const COMPLETION_LABELS: Record<CompletionMode, string> = {
  OTP: "Rider's code",
  DRIVER_OVERRIDE: "Driver override (no code)",
  ADMIN: "Completed by support",
  SOS: "Ended during an SOS",
  NOT_REQUIRED: "Code not required",
};

const chip = "inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800";

/** The "look at this one" chips of a trip that ended unusually. Nothing for a normal OTP end. */
export function RideEndBadge({ end }: { end: Pick<RideEndInfo, "mode" | "farFromDestination" | "needsReview"> }) {
  if (!end.needsReview) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {end.mode && end.mode !== "OTP" && end.mode !== "NOT_REQUIRED" && <span className={chip}>{COMPLETION_LABELS[end.mode]}</span>}
      {end.farFromDestination && <span className={chip}>Far from drop-off</span>}
    </span>
  );
}
