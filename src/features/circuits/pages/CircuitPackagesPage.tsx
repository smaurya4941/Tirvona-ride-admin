import { useState } from "react";
import { Plus, Route } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { FilterTabs } from "@/components/DetailUi";
import { Button, LoadState, PageHeader, Pill, SearchBox, Table, cell } from "@/components/Ui";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { PACKAGE_STATUSES, circuitCoverUrl, formatDuration, useCircuitPackages } from "../api";
import type { PackageStatus } from "../api";

export const PACKAGE_STATUS_TONE: Record<PackageStatus, "slate" | "green" | "amber" | "red"> = {
  DRAFT: "slate",
  ACTIVE: "green",
  INACTIVE: "amber",
  ARCHIVED: "red",
};

export function CircuitPackagesPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<PackageStatus | undefined>();
  const [q, setQ] = useState("");
  const { data, error, isPending } = useCircuitPackages({ status, q: q || undefined });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Circuit packages"
        subtitle="Multi-stop packages customers book with a vehicle and driver for a fixed time and distance. Bookings keep the terms they were booked on."
        actions={
          <Button onClick={() => navigate("/circuits/packages/new")}>
            <Plus className="h-4 w-4" aria-hidden /> New circuit
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs options={[undefined, ...PACKAGE_STATUSES]} value={status} onChange={setStatus} label="Status" render={(value) => (value ? titleCase(value) : "All")} />
        <SearchBox value={q} onChange={setQ} placeholder="Search name or code" />
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <LoadState pending={isPending} error={error} empty={data?.length === 0} emptyText="No circuit packages yet. Create the first one.">
          <Table head={["Package", "City", "Stops", "Time", "Distance", "Vehicles & prices", "Status", "Updated"]}>
            {data?.map((pkg) => {
              const cover = circuitCoverUrl(pkg);
              return (
                <tr key={pkg.id} className="hover:bg-slate-50">
                  <td className={cell}>
                    <Link to={`/circuits/packages/${pkg.id}`} className="flex items-center gap-3">
                      <span className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Route className="h-4 w-4 text-slate-300" aria-hidden />}
                      </span>
                      <span>
                        <span className="block font-semibold text-slate-900 hover:underline">{pkg.name}</span>
                        <span className="block font-mono text-[11px] text-slate-500">{pkg.code}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={cell}>{pkg.city}</td>
                  <td className={cell}>
                    <span title={pkg.stops.map((stop) => `${stop.order}. ${stop.name}`).join("\n")}>{pkg.stops.length}</span>
                  </td>
                  <td className={cell}>{pkg.pricing ? formatDuration(pkg.pricing.includedDurationSeconds) : "—"}</td>
                  <td className={cell}>{pkg.pricing ? `${pkg.pricing.includedDistanceKm} km` : "—"}</td>
                  <td className={cell}>
                    {pkg.rideTypes.length === 0 ? (
                      "—"
                    ) : (
                      <ul className="space-y-0.5 whitespace-nowrap">
                        {pkg.rideTypes.map((code) => {
                          const price = pkg.vehiclePricing.find((entry) => entry.rideType === code);
                          return (
                            <li key={code} className="flex justify-between gap-3">
                              <span>{titleCase(code)}</span>
                              {price ? (
                                <span className="font-semibold tabular-nums">{formatMoney(price.basePrice)}</span>
                              ) : (
                                <span className="text-[11px] text-amber-700">no price</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className={cell}>
                    <div className="flex flex-col items-start gap-1">
                      <Pill tone={PACKAGE_STATUS_TONE[pkg.status]}>{titleCase(pkg.status)}</Pill>
                      {pkg.status === "DRAFT" && pkg.publishProblems.length > 0 && (
                        <span className="text-[11px] text-amber-700">{pkg.publishProblems.length} to fix before publishing</span>
                      )}
                    </div>
                  </td>
                  <td className={`${cell} whitespace-nowrap text-xs text-slate-500`}>{formatDateTime(pkg.updatedAt)}</td>
                </tr>
              );
            })}
          </Table>
        </LoadState>
      </section>
    </div>
  );
}
