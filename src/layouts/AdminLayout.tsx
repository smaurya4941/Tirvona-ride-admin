import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { navigation } from "@/app/navigation";
import { logout } from "@/features/auth/api/auth";
import { BrandLogo } from "@/features/branding/components/BrandLogo";
import { useUnreadNotifications } from "@/features/notifications/api/notifications";
import { useSosSummary } from "@/features/safety/api/sos";
import { SosAlertBanner } from "@/features/safety/components/SosAlertBanner";
import { useSession } from "@/lib/auth/session";

export function AdminLayout() {
  const current = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: unread } = useUnreadNotifications();
  const { data: sos } = useSosSummary();
  // Live counters next to nav items.
  const counters: Record<string, { value: number; urgent: boolean } | undefined> = {
    "/safety": sos?.open ? { value: sos.open, urgent: sos.unacknowledged > 0 } : undefined,
    "/notifications": unread ? { value: unread, urgent: false } : undefined,
  };

  // The most specific nav item wins: /payments/refunds lights up "Refunds",
  // /payments/:id still lights up "Payments".
  const { pathname } = useLocation();
  const activePath = navigation
    .flatMap((section) => section.items.map((item) => item.path))
    .filter((path) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)))
    .sort((a, b) => b.length - a.length)[0];

  async function handleSignOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  const nav = (
    <nav className="flex-1 space-y-3 overflow-y-auto px-2 pb-2" aria-label="Main">
      {navigation.map((section, index) => (
        <div key={section.title ?? index}>
          {section.title && (
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
          )}
          <div className="space-y-0.5">
            {section.items.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                onClick={() => setOpen(false)}
                className={() =>
                  `group flex items-center gap-3 rounded-md px-2 py-1.5 text-[13px] font-medium transition-all ${
                    path === activePath ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon className={`h-4 w-4 ${path === activePath ? "text-slate-100" : "text-slate-400 group-hover:text-slate-600"}`} aria-hidden />
                {label}
                {counters[path] && (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      counters[path]!.urgent ? "animate-pulse bg-red-600 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {counters[path]!.value}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-slate-200 p-2">
      {current && (
        <p className="truncate px-2 pb-1.5 text-[11px] text-slate-500">
          {[current.user.firstName, current.user.lastName].filter(Boolean).join(" ")} · {current.user.phone}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut className="h-4 w-4 text-slate-400 group-hover:text-slate-600" aria-hidden />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-4 py-4">
          <h2 className="text-sm font-bold text-slate-900">Tirvona Admin</h2>
        </div>
        {nav}
        {footer}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="relative flex h-full w-72 flex-col bg-white pt-4">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded p-1 hover:bg-slate-100" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <div className="px-4 pb-4">
              <h2 className="text-sm font-bold text-slate-900">Tirvona Admin</h2>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button type="button" onClick={() => setOpen(true)} className="rounded p-1 hover:bg-slate-100" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <BrandLogo className="h-9" />
          <span className="sr-only">Tirvona Rides admin</span>
        </div>
        <SosAlertBanner />
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
