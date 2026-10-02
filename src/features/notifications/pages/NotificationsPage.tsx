import { useState } from "react";
import { Bell, CheckCheck, Loader2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FilterTabs, Pager } from "@/components/DetailUi";
import { formatDateTime } from "@/lib/format";
import { notificationLink, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "../api/notifications";
import type { AdminNotification } from "../api/notifications";

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"UNREAD" | undefined>(undefined);
  const { data, error, isPending, isFetching } = useNotifications(page, filter === "UNREAD");
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  function open(notification: AdminNotification) {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = notificationLink(notification);
    if (link) navigate(link);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-midnight">Notifications</h1>
          <p className="text-sm text-slate-500">New SOS alerts and complaints addressed to operations</p>
        </div>
        {!!data?.unreadCount && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read ({data.unreadCount})
          </button>
        )}
      </header>

      <FilterTabs<"UNREAD">
        label="Filter"
        options={[undefined, "UNREAD"]}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
        render={(value) => (value ? "Unread" : "All")}
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </p>
        ) : error ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-red-600">
            <XCircle className="h-4 w-4" aria-hidden /> {error.message}
          </p>
        ) : data.items.length === 0 ? (
          <p className="flex flex-col items-center gap-2 px-5 py-12 text-sm text-slate-500">
            <Bell className="h-8 w-8 text-slate-300" aria-hidden /> Nothing here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className={`flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 ${notification.isRead ? "" : "bg-bhagwa-100/40"}`}
                >
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      notification.isRead ? "bg-transparent" : notification.type.startsWith("SOS") ? "bg-red-600" : "bg-bhagwa-500"
                    }`}
                  />
                  <span className="flex-1">
                    <span className={`block text-sm ${notification.isRead ? "font-medium text-slate-800" : "font-bold text-midnight"}`}>
                      {notification.title}
                    </span>
                    <span className="block text-sm text-slate-600">{notification.message}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{formatDateTime(notification.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && (
          <Pager
            page={data.page}
            limit={data.limit}
            count={data.items.length}
            total={data.total}
            hasMore={data.hasMore}
            fetching={isFetching}
            onPage={setPage}
          />
        )}
      </section>
    </div>
  );
}
