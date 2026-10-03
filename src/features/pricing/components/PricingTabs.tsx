import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/pricing", label: "Vehicle pricing", end: true },
  { to: "/pricing/peak-hours", label: "Peak hours", end: false },
];

/** Switches between the two halves of Pricing: permanent tariffs and peak adjustments. */
export function PricingTabs() {
  return (
    <nav className="flex gap-1 border-b border-slate-200" aria-label="Pricing sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
              isActive ? "border-bhagwa-500 text-bhagwa-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
