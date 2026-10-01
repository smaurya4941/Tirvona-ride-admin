import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";
import type { Page } from "@/features/rides/api/rides";

export const COMPLAINT_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type ComplaintPriority = (typeof COMPLAINT_PRIORITIES)[number];

export const COMPLAINT_CATEGORIES = [
  "DRIVER_BEHAVIOUR",
  "CUSTOMER_BEHAVIOUR",
  "PAYMENT",
  "FARE",
  "RIDE_ISSUE",
  "SAFETY",
  "LOST_ITEM",
  "TECHNICAL",
  "OTHER",
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

/** Workflow allowed by the server (RESOLVED can be reopened; CLOSED is final). */
export const COMPLAINT_NEXT: Record<ComplaintStatus, ComplaintStatus[]> = {
  OPEN: ["IN_REVIEW", "RESOLVED", "CLOSED"],
  IN_REVIEW: ["RESOLVED", "CLOSED"],
  RESOLVED: ["IN_REVIEW", "CLOSED"],
  CLOSED: [],
};

interface Person {
  id: string;
  name: string;
  phone: string;
}

export interface ComplaintListItem {
  id: string;
  ticketCode: string;
  category: ComplaintCategory;
  subject: string;
  description: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  userRole: "CUSTOMER" | "DRIVER";
  user: Person | null;
  customer: Person | null;
  driver: (Person & { driverId: string; driverCode: string }) | null;
  assignedAdmin: { id: string; name: string } | null;
  rideId?: string;
  rideCode?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface ComplaintDetail extends ComplaintListItem {
  ride: {
    id: string;
    rideCode: string;
    status: string;
    rideType: string;
    pickupAddress: string;
    destinationAddress: string;
    finalFare?: number;
    estimatedFare: number;
    paymentStatus: string;
    requestedAt: string;
    completedAt?: string;
  } | null;
  history: Array<{ at: string; action: string; status?: ComplaintStatus; note?: string; byRole: string; by: string | null }>;
}

export interface ComplaintSummary {
  open: number;
  inReview: number;
  urgentOpen: number;
  resolvedToday: number;
}

export interface ComplaintFilters {
  page: number;
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  priority?: ComplaintPriority;
  search?: string;
}

const keys = {
  all: ["admin", "complaints"] as const,
  list: (filters: ComplaintFilters) => [...keys.all, "list", filters] as const,
  summary: () => [...keys.all, "summary"] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
};

export function useComplaints(filters: ComplaintFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<ComplaintListItem>>>("/admin/complaints", {
          params: {
            page: filters.page,
            limit: 25,
            status: filters.status,
            category: filters.category,
            priority: filters.priority,
            search: filters.search?.trim() || undefined,
          },
        })
      ).data.data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useComplaintSummary() {
  return useQuery({
    queryKey: keys.summary(),
    queryFn: async () => (await apiClient.get<ApiSuccess<ComplaintSummary>>("/admin/complaints/summary")).data.data,
    refetchInterval: 30_000,
  });
}

export function useComplaint(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await apiClient.get<ApiSuccess<ComplaintDetail>>(`/admin/complaints/${id}`)).data.data,
  });
}

export interface ComplaintUpdate {
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
  resolution?: string;
  note?: string;
  assignToMe?: boolean;
}

export function useUpdateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: ComplaintUpdate & { id: string }) =>
      (await apiClient.patch<ApiSuccess<ComplaintDetail>>(`/admin/complaints/${id}`, body)).data.data,
    onSuccess: (detail) => {
      queryClient.setQueryData(keys.detail(detail.id), detail);
      return queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });
}
