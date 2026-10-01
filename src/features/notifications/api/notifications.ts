import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";

/** The admin's own notifications (new SOS, new complaints), from the shared API. */
export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  rideId?: string;
  referenceId?: string;
  data: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPage {
  items: AdminNotification[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  unreadCount: number;
}

const keys = {
  all: ["admin", "notifications"] as const,
  list: (page: number, unreadOnly: boolean) => [...keys.all, "list", page, unreadOnly] as const,
  unread: () => [...keys.all, "unread"] as const,
};

export function useNotifications(page: number, unreadOnly: boolean) {
  return useQuery({
    queryKey: keys.list(page, unreadOnly),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<NotificationPage>>("/notifications", {
          params: { page, limit: 25, unreadOnly: unreadOnly || undefined },
        })
      ).data.data,
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: keys.unread(),
    queryFn: async () =>
      (await apiClient.get<ApiSuccess<{ unreadCount: number }>>("/notifications/unread-count")).data.data.unreadCount,
    refetchInterval: 20_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.patch("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

/** Where an admin notification leads inside the panel. */
export function notificationLink(notification: AdminNotification): string | undefined {
  if (notification.type.startsWith("SOS") && notification.referenceId) return `/safety/${notification.referenceId}`;
  if (notification.type.startsWith("COMPLAINT") && notification.referenceId) return `/complaints/${notification.referenceId}`;
  if (notification.rideId) return `/rides/${notification.rideId}`;
  return undefined;
}
