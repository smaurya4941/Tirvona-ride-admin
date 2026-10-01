import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { DriverListItem } from "../api/drivers";
import { DriverStatusBadge } from "./DriverStatusBadge";

export function DriverTable({ drivers }: { drivers: DriverListItem[] }) {
  if (drivers.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">No drivers in this state.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Driver</th>
            <th className="px-5 py-3 font-medium">Phone</th>
            <th className="px-5 py-3 font-medium">Code</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium sr-only">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {drivers.map(({ driver, user }) => (
            <tr key={driver.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-900">
                {[user.firstName, user.lastName].filter(Boolean).join(" ")}
              </td>
              <td className="px-5 py-3 text-slate-600">{user.phone}</td>
              <td className="px-5 py-3 font-mono text-xs text-slate-500">{driver.driverCode}</td>
              <td className="px-5 py-3">
                <DriverStatusBadge status={driver.driverStatus} />
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  to={`/drivers/${driver.id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-bhagwa-600 hover:underline"
                >
                  View <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
