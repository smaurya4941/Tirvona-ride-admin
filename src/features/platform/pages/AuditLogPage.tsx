import { Link, useSearchParams } from "react-router-dom";
import { FilterTabs, Pager } from "@/components/DetailUi";
import { LoadState, PageHeader, Table, cell } from "@/components/Ui";
import { formatDateTime, titleCase } from "@/lib/format";
import { useAuditLog } from "../api";
import type { AuditEntry } from "../api";

const TARGETS = ["DRIVER", "CUSTOMER", "RIDE", "RIDE_TYPE", "PRICING", "ZONE", "PROMO", "CANCELLATION", "CANCELLATION_POLICY", "BROADCAST"] as const;

function targetLink(entry: AuditEntry): string | null {
  switch (entry.targetType) {
    case "DRIVER":
      return `/drivers/${entry.targetId}`;
    case "CUSTOMER":
      return `/customers/${entry.targetId}`;
    case "RIDE":
      return `/rides/${entry.targetId}`;
    case "ZONE":
      return `/zones/${entry.targetId}`;
    case "PROMO":
      return `/promotions/${entry.targetId}`;
    case "RIDE_TYPE":
      return "/ride-types";
    case "PRICING":
      return "/pricing";
    case "BROADCAST":
      return "/broadcasts";
    case "CANCELLATION":
    case "CANCELLATION_POLICY":
    case "CANCELLATION_REASON":
      return "/cancellations";
    default:
      return null;
  }
}

export function AuditLogPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const targetType = params.get("targetType") ?? undefined;
  const targetId = params.get("targetId") ?? undefined;
  const { data, error, isPending, isFetching } = useAuditLog({ page, targetType, targetId });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Audit log" subtitle="Every high-impact admin action: who did what, to which record, why and when. Read-only." />
      <FilterTabs<string>
        label="Record type"
        options={[undefined, ...TARGETS]}
        value={targetType}
        onChange={(value) => setParams(value ? { targetType: value } : {})}
        render={(value) => (value ? titleCase(value) : "Everything")}
      />
      {targetId && (
        <p className="text-sm text-slate-600">
          Showing one record only.{" "}
          <button type="button" className="font-semibold text-bhagwa-600 hover:underline" onClick={() => setParams(targetType ? { targetType } : {})}>
            Show all
          </button>
        </p>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No admin actions recorded yet.">
          {data && (
            <>
              <Table head={["When", "Admin", "Action", "Record", "Reason / details"]}>
                {data.items.map((entry) => {
                  const link = targetLink(entry);
                  return (
                    <tr key={entry.id}>
                      <td className={`${cell} whitespace-nowrap text-slate-500`}>{formatDateTime(entry.createdAt)}</td>
                      <td className={cell}>{entry.adminName ?? entry.adminId}</td>
                      <td className={`${cell} font-mono text-xs`}>{entry.action}</td>
                      <td className={cell}>
                        {link ? (
                          <Link to={link} className="font-semibold text-bhagwa-600 hover:underline">
                            {entry.targetLabel ?? entry.targetId}
                          </Link>
                        ) : (
                          (entry.targetLabel ?? entry.targetId)
                        )}
                        <span className="block text-xs text-slate-500">{titleCase(entry.targetType)}</span>
                      </td>
                      <td className={`${cell} max-w-sm text-slate-600`}>
                        {entry.reason && <p>{entry.reason}</p>}
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <details className="text-xs text-slate-500">
                            <summary className="cursor-pointer">Details</summary>
                            <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(entry.metadata, null, 2)}</pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
              <Pager
                page={data.page}
                limit={data.limit}
                count={data.items.length}
                total={data.total}
                hasMore={data.hasMore}
                fetching={isFetching}
                onPage={(next) => setParams({ ...(targetType ? { targetType } : {}), ...(targetId ? { targetId } : {}), page: String(next) })}
              />
            </>
          )}
        </LoadState>
      </section>
    </div>
  );
}
