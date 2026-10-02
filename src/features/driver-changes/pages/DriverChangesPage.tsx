import { Link, useSearchParams } from "react-router-dom";
import { FilterTabs, Pager, timeAgo } from "@/components/DetailUi";
import { LoadState, PageHeader, Table, cell } from "@/components/Ui";
import { formatDateTime, titleCase } from "@/lib/format";
import { DRIVER_CHANGE_STATUSES, displayValue, fieldLabel, useDriverChangeSummary, useDriverChanges } from "../api/driverChanges";
import type { DriverChange, DriverChangeStatus } from "../api/driverChanges";
import { DriverChangeStatusPill } from "../components/DriverChangeStatusPill";

/** "Colour: Green → Yellow" lines for the queue. */
function summary(change: DriverChange): string {
  const fields = Object.entries(change.changes).map(
    ([field, value]) => `${fieldLabel(field)}: ${displayValue(change.previous[field])} → ${displayValue(value)}`,
  );
  if (change.hasFile || change.kind.endsWith("DOCUMENT")) fields.unshift(change.previous.documentId ? "Replacement copy" : "New document");
  return fields.join(" · ");
}

/**
 * Changes approved drivers asked for to verified details — licence, vehicle
 * and documents. Nothing reaches the live profile until approved here.
 */
export function DriverChangesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = DRIVER_CHANGE_STATUSES.find((value) => value === searchParams.get("status")) ?? "PENDING";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const driverId = searchParams.get("driverId") ?? undefined;
  const { data, error, isPending, isFetching } = useDriverChanges({ page, status, driverId });
  const { data: counts } = useDriverChangeSummary();

  function apply(next: { status?: DriverChangeStatus; page?: number }) {
    const params: Record<string, string> = {};
    const nextStatus = next.status ?? status;
    if (nextStatus !== "PENDING") params.status = nextStatus;
    if (next.page && next.page > 1) params.page = String(next.page);
    if (driverId) params.driverId = driverId;
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Driver updates"
        subtitle={
          counts
            ? `${counts.pending} waiting for review · oldest first. Drivers keep their verified details until you approve.`
            : "Changes approved drivers asked for to their licence, vehicle and documents"
        }
      />
      {driverId && (
        <p className="text-sm text-slate-600">
          Showing one driver.{" "}
          <button type="button" className="font-semibold text-bhagwa-600 hover:underline" onClick={() => setSearchParams(status === "PENDING" ? {} : { status })}>
            Show all drivers
          </button>
        </p>
      )}
      <FilterTabs<DriverChangeStatus>
        label="Filter by status"
        options={DRIVER_CHANGE_STATUSES}
        value={status}
        onChange={(value) => apply({ status: value ?? "PENDING", page: 1 })}
        render={(value) => (value === "PENDING" ? "Waiting for review" : titleCase(value ?? ""))}
      />
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <LoadState
          pending={isPending}
          error={error}
          empty={data?.items.length === 0}
          emptyText={status === "PENDING" ? "Nothing waiting for review." : "No updates here."}
        >
          <Table head={["Driver", "Update", "Change", "Submitted", status === "PENDING" ? "Waiting" : "Reviewed", "Status"]}>
            {data?.items.map((change) => (
              <tr key={change.id} className="hover:bg-slate-50">
                <td className={cell}>
                  <Link to={`/drivers/${change.driver.id}`} className="font-medium text-slate-900 hover:underline">
                    {change.driver.name}
                  </Link>
                  <p className="font-mono text-xs text-slate-500">{change.driver.driverCode}</p>
                </td>
                <td className={cell}>
                  <Link to={`/driver-updates/${change.id}`} className="font-semibold text-bhagwa-600 hover:underline">
                    {change.label}
                  </Link>
                </td>
                <td className={`${cell} max-w-md text-slate-700`}>{summary(change) || "—"}</td>
                <td className={`${cell} whitespace-nowrap text-xs text-slate-600`}>{formatDateTime(change.submittedAt)}</td>
                <td className={`${cell} whitespace-nowrap text-xs text-slate-600`}>
                  {status === "PENDING" ? timeAgo(change.submittedAt) : formatDateTime(change.reviewedAt)}
                </td>
                <td className={cell}>
                  <DriverChangeStatusPill status={change.status} />
                </td>
              </tr>
            ))}
          </Table>
        </LoadState>
        {data && (
          <Pager
            page={data.page}
            limit={data.limit}
            count={data.items.length}
            total={data.total}
            hasMore={data.hasMore}
            fetching={isFetching}
            onPage={(next) => apply({ page: next })}
          />
        )}
      </section>
    </div>
  );
}
