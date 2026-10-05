import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/features/rides/api/rides";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";

export const DRIVER_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];
export type DocumentStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface DriverSummary {
  id: string;
  driverCode: string;
  driverStatus: DriverStatus;
  licenseNumber?: string;
  licenseExpiry?: string;
  dateOfBirth?: string;
  address?: string;
  ratingAverage: number;
  totalRides: number;
  approvedAt?: string;
  rejectionReason?: string;
  isOnline?: boolean;
  isAvailable?: boolean;
  /** May be offered circuit rides. */
  circuitEligible?: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  createdAt?: string;
}

export interface DriverListItem {
  driver: DriverSummary;
  user: { id: string; firstName: string; lastName?: string; phone: string; email?: string };
}

export interface DriverDocument {
  id: string;
  documentType: string;
  documentNumber?: string;
  status: DocumentStatus;
  rejectionReason?: string;
}

export interface VehicleSummary {
  id: string;
  vehicleType: "BIKE" | "AUTO" | "E_RICKSHAW" | "CAB";
  registrationNumber: string;
  make?: string;
  model?: string;
  color?: string;
  manufactureYear?: number;
  isActive: boolean;
}

export interface DriverDetail {
  driver: DriverSummary;
  user: {
    id: string;
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
    isPhoneVerified: boolean;
    createdAt: string;
  };
  documents: DriverDocument[];
  vehicles: Array<{ vehicle: VehicleSummary; documents: DriverDocument[] }>;
}

export interface DashboardReport {
  /** Phase 5 */
  safety: { open: number; unacknowledged: number; acknowledged: number; inProgress: number; resolvedToday: number; oldestUnacknowledgedAt?: string };
  support: { open: number; inReview: number; urgentOpen: number; resolvedToday: number };
  pendingDrivers: number;
  underReviewDrivers: number;
  approvedDrivers: number;
  rejectedDrivers: number;
  suspendedDrivers: number;
  totalDrivers: number;
  rides: {
    activeRides: number;
    searching: number;
    inProgress: number;
    completedToday: number;
    cancelledToday: number;
    noDriverToday: number;
    driversOnline: number;
    driversAvailable: number;
    /** Online + available + a location fresh enough to be matched. */
    driversMatchable: number;
  };
  /** The selected period (default today, India time). */
  period: {
    preset: "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CUSTOM";
    from: string;
    to: string;
    days: number;
    requested: number;
    completed: number;
    cancelled: number;
    completedRideValue: number;
    collected: number;
    platformCommission: number;
    newCustomers: number;
  };
  totals: { customers: number; approvedDrivers: number };
  trend: Array<{ date: string; requested: number; completed: number; cancelled: number; revenue: number }>;
}

const keys = {
  all: ["admin", "drivers"] as const,
  list: (filters: DriverFilters) => [...keys.all, "list", filters] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
  dashboard: ["admin", "dashboard"] as const,
};

/** Preset, or a custom from/to pair of local dates (both inclusive). */
export interface DashboardRange {
  preset: DashboardReport["period"]["preset"];
  from?: string;
  to?: string;
}

export function useDashboard(range: DashboardRange = { preset: "TODAY" }) {
  const params = range.preset === "CUSTOM" ? { from: range.from, to: range.to } : { preset: range.preset };
  return useQuery({
    queryKey: [...keys.dashboard, params],
    queryFn: async () => (await apiClient.get<ApiSuccess<DashboardReport>>("/admin/dashboard", { params })).data.data,
    enabled: range.preset !== "CUSTOM" || Boolean(range.from && range.to),
    placeholderData: keepPreviousData,
    // Live ride counts; paused automatically while the tab is hidden.
    refetchInterval: 15_000,
  });
}

export interface DriverFilters {
  page: number;
  status?: DriverStatus;
  search?: string;
}

export function useDrivers(filters: DriverFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<DriverListItem>>>("/admin/drivers", {
          params: { page: filters.page, limit: 25, status: filters.status, search: filters.search || undefined },
        })
      ).data.data,
    placeholderData: keepPreviousData,
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await apiClient.get<ApiSuccess<DriverDetail>>(`/admin/drivers/${id}`)).data.data,
  });
}

function useDriverDecision<TVariables>(request: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    // Status changes move the driver between list tabs and dashboard counts.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all }),
        queryClient.invalidateQueries({ queryKey: keys.dashboard }),
      ]),
  });
}

export function useApproveDriver() {
  return useDriverDecision((id: string) => apiClient.patch(`/admin/drivers/${id}/approve`));
}

export function useRejectDriver() {
  return useDriverDecision(({ id, reason }: { id: string; reason: string }) =>
    apiClient.patch(`/admin/drivers/${id}/reject`, { reason }),
  );
}

export function useSuspendDriver() {
  return useDriverDecision(({ id, reason }: { id: string; reason: string }) =>
    apiClient.patch(`/admin/drivers/${id}/suspend`, { reason }),
  );
}

export function useReinstateDriver() {
  return useDriverDecision(({ id, reason }: { id: string; reason?: string }) =>
    apiClient.patch(`/admin/drivers/${id}/reinstate`, { reason }),
  );
}

/**
 * Document files sit behind the admin JWT, so they can't be plain <img src>
 * or <a href> links — fetch the bytes with the auth header and hand back an
 * object URL the caller must revoke.
 */
export async function fetchDocumentObjectUrl(path: string): Promise<{ url: string; type: string }> {
  const response = await apiClient.get<Blob>(path, { responseType: "blob" });
  return { url: URL.createObjectURL(response.data), type: response.data.type };
}

export const documentFilePath = {
  driver: (driverId: string, documentId: string) => `/admin/drivers/${driverId}/documents/${documentId}/file`,
  vehicle: (documentId: string) => `/admin/vehicles/documents/${documentId}/file`,
};
