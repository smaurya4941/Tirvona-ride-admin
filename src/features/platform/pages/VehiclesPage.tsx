import { Link, useSearchParams } from "react-router-dom";
import { FilterTabs, Pager } from "@/components/DetailUi";
import { LoadState, PageHeader, Pill, SearchBox, Table, cell } from "@/components/Ui";
import { formatDateTime, titleCase } from "@/lib/format";
import { VEHICLE_TYPES, useVehicles } from "../api";
import type { VehicleType } from "../api";

export function VehiclesPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("q") ?? "";
  const vehicleType = VEHICLE_TYPES.find((type) => type === params.get("type"));
  const { data, error, isPending, isFetching } = useVehicles({ page, search, vehicleType });

  function update(next: { q?: string; type?: VehicleType; page?: number }) {
    const merged = { q: search, type: vehicleType, page: 1, ...next };
    const out: Record<string, string> = {};
    if (merged.q) out.q = merged.q;
    if (merged.type) out.type = merged.type;
    if (merged.page > 1) out.page = String(merged.page);
    setParams(out);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Vehicles" subtitle="Every registered vehicle and the driver it belongs to. Documents are reviewed on the driver's page." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs<VehicleType> label="Vehicle type" options={[undefined, ...VEHICLE_TYPES]} value={vehicleType} onChange={(type) => update({ type })} render={(type) => (type ? titleCase(type) : "All")} />
        <SearchBox value={search} onChange={(q) => update({ q })} placeholder="Registration number" />
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <LoadState pending={isPending} error={error} empty={data?.items.length === 0} emptyText="No vehicles match.">
          {data && (
            <>
              <Table head={["Registration", "Type", "Vehicle", "Driver", "State", "Added"]}>
                {data.items.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-slate-50">
                    <td className={`${cell} font-mono font-semibold`}>{vehicle.registrationNumber}</td>
                    <td className={cell}>{titleCase(vehicle.vehicleType)}</td>
                    <td className={`${cell} text-slate-600`}>
                      {[vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
                      {vehicle.manufactureYear && <span className="block text-xs text-slate-400">{vehicle.manufactureYear}</span>}
                    </td>
                    <td className={cell}>
                      {vehicle.driver ? (
                        <Link to={`/drivers/${vehicle.driver.id}`} className="font-semibold text-bhagwa-600 hover:underline">
                          {vehicle.driver.name || vehicle.driver.driverCode}
                          <span className="block text-xs font-normal text-slate-500">
                            {vehicle.driver.phone} · {titleCase(vehicle.driver.driverStatus)}
                          </span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={cell}>{vehicle.isActive ? <Pill tone="green">Active</Pill> : <Pill>Deactivated</Pill>}</td>
                    <td className={`${cell} text-slate-500`}>{formatDateTime(vehicle.createdAt)}</td>
                  </tr>
                ))}
              </Table>
              <Pager page={data.page} limit={data.limit} count={data.items.length} total={data.total} hasMore={data.hasMore} fetching={isFetching} onPage={(next) => update({ page: next })} />
            </>
          )}
        </LoadState>
      </section>
    </div>
  );
}
