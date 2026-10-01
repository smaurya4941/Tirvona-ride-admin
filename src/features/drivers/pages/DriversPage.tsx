import { useSearchParams } from "react-router-dom";
import { FilterTabs, Pager } from "@/components/DetailUi";
import { LoadState, PageHeader, SearchBox } from "@/components/Ui";
import { DRIVER_STATUSES, useDrivers } from "../api/drivers";
import type { DriverStatus } from "../api/drivers";
import { DriverTable } from "../components/DriverTable";
import { statusLabel } from "../components/DriverStatusBadge";

const FILTERS: Array<DriverStatus | undefined> = [undefined, "UNDER_REVIEW", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"];

function parseStatus(value: string | null): DriverStatus | undefined {
  return DRIVER_STATUSES.find((status) => status === value);
}

export function DriversPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));
  const search = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const { data, error, isPending, isFetching } = useDrivers({ page, status, search });

  function update(next: { status?: DriverStatus; q?: string; page?: number }) {
    const merged = { status, q: search, page: 1, ...next };
    const params: Record<string, string> = {};
    if (merged.status) params.status = merged.status;
    if (merged.q) params.q = merged.q;
    if (merged.page > 1) params.page = String(merged.page);
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Drivers & KYC" subtitle="Review KYC submissions, approve, suspend and reinstate drivers" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs<DriverStatus>
          label="Filter by status"
          options={FILTERS}
          value={status}
          onChange={(value) => update({ status: value })}
          render={(value) => (value ? statusLabel(value) : "All")}
        />
        <SearchBox value={search} onChange={(q) => update({ q })} placeholder="Name, phone or driver code" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No drivers match these filters.">
          {data && (
            <>
              <DriverTable drivers={data.items} />
              <Pager page={data.page} limit={data.limit} count={data.items.length} total={data.total} hasMore={data.hasMore} fetching={isFetching} onPage={(next) => update({ page: next })} />
            </>
          )}
        </LoadState>
      </section>
    </div>
  );
}
