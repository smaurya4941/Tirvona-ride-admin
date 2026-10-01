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
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4" aria-label="Main">
      {navigation.map((section, index) => (
        <div key={section.title ?? index}>
          {section.title && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
          )}
          <div className="space-y-0.5">
            {section.items.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                onClick={() => setOpen(false)}
                className={() =>
                  `flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    path === activePath ? "bg-bhagwa-100 text-bhagwa-600" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
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
    <div className="border-t border-slate-200 p-3">
      {current && (
        <p className="truncate px-3 pb-2 text-xs text-slate-500">
          {[current.user.firstName, current.user.lastName].filter(Boolean).join(" ")} · {current.user.phone}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-sand">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-6 py-5">
          <BrandLogo className="h-24 w-full" />
          <p className="mt-2 text-center text-xs text-slate-500">Operations admin</p>
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
            <div className="px-6 pb-4">
              <BrandLogo className="h-20 w-full" />
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
