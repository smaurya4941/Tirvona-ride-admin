import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/features/rides/api/rides";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";
import type { DriverStatus } from "@/features/drivers/api/drivers";

export const DRIVER_CHANGE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const;
export type DriverChangeStatus = (typeof DRIVER_CHANGE_STATUSES)[number];
export type DriverChangeKind = "DRIVER_PROFILE" | "VEHICLE" | "DRIVER_DOCUMENT" | "VEHICLE_DOCUMENT";

/** A change an approved driver asked for; nothing is live until approved. */
export interface DriverChange {
  id: string;
  kind: DriverChangeKind;
  label: string;
  status: DriverChangeStatus;
  vehicleId?: string;
  documentType?: string;
  /** Requested values by field. */
  changes: Record<string, unknown>;
  /** The verified values they replace (null = not set). */
  previous: Record<string, unknown>;
  hasFile: boolean;
  reviewNote?: string;
  submittedAt: string;
  reviewedAt?: string;
  driver: { id: string; driverCode: string; driverStatus: DriverStatus; name: string; phone: string };
}

export interface DriverChangeFilters {
  page: number;
  status: DriverChangeStatus;
  driverId?: string;
}

const keys = {
  all: ["admin", "driver-changes"] as const,
  list: (filters: DriverChangeFilters) => [...keys.all, "list", filters] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
  summary: ["admin", "driver-changes", "summary"] as const,
};

export const driverChangeFilePath = (id: string) => `/admin/driver-change-requests/${id}/file`;

export function useDriverChanges(filters: DriverChangeFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<DriverChange>>>("/admin/driver-change-requests", {
          params: { page: filters.page, limit: 25, status: filters.status, driverId: filters.driverId },
        })
      ).data.data,
    placeholderData: keepPreviousData,
  });
}

export function useDriverChange(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await apiClient.get<ApiSuccess<DriverChange>>(`/admin/driver-change-requests/${id}`)).data.data,
  });
}

export function useDriverChangeSummary() {
  return useQuery({
    queryKey: keys.summary,
    queryFn: async () =>
      (await apiClient.get<ApiSuccess<{ pending: number }>>("/admin/driver-change-requests/summary")).data.data,
    refetchInterval: 60_000,
  });
}

function useDecision<TVariables>(request: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    // The change moves between tabs and updates the driver's detail page.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all }),
        queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] }),
      ]),
  });
}

export function useApproveDriverChange() {
  return useDecision((id: string) => apiClient.post(`/admin/driver-change-requests/${id}/approve`));
}

export function useRejectDriverChange() {
  return useDecision(({ id, reason }: { id: string; reason: string }) =>
    apiClient.post(`/admin/driver-change-requests/${id}/reject`, { reason }),
  );
}

const FIELD_LABELS: Record<string, string> = {
  licenseNumber: "Licence number",
  licenseExpiry: "Licence valid until",
  dateOfBirth: "Date of birth",
  vehicleType: "Vehicle type",
  registrationNumber: "Registration",
  make: "Make",
  model: "Model",
  color: "Colour",
  manufactureYear: "Year",
  documentNumber: "Document number",
  expiryDate: "Valid until",
  status: "Status on file",
};

export const fieldLabel = (field: string): string => FIELD_LABELS[field] ?? field;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/;

/** Dates stored as UTC midnight read as calendar days. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && ISO_DATE.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  return String(value);
}
