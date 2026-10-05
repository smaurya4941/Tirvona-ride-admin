/**
 * Tirvona Circuit — packages Admin sells, and the circuit bookings customers
 * make from them. The server owns every rule (publishing, pricing, stop order,
 * final fare); this panel only configures packages and issues explicit
 * commands (resolve, end, cancel), each kept in the audit log.
 */
import { env } from "@/config/env";
import { apiClient, useApi, useApiMutation } from "@/lib/api/hooks";
import type { ApiSuccess } from "@/lib/api/client";
import type { Page, RideBase, RideDetail } from "@/features/rides/api/rides";

// ── Packages ───────────────────────────────────────────────────────────

export const PACKAGE_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

/** Mirrors PACKAGE_STATUS_TRANSITIONS on the server. */
export const NEXT_STATUSES: Record<PackageStatus, PackageStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["INACTIVE", "ARCHIVED"],
  INACTIVE: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface PackageStop {
  order: number;
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface PackagePricing {
  basePrice: number;
  includedDistanceKm: number;
  includedDurationHours: number;
  includedDistanceMeters: number;
  includedDurationSeconds: number;
  extraDistanceRatePerKm: number;
  extraDurationRatePerHour: number;
}

export interface PackageAvailability {
  days: number[];
  opensAt: string;
  closesAt: string;
  validFrom?: string;
  validUntil?: string;
}

export interface CircuitPackage {
  id: string;
  code: string;
  name: string;
  description: string;
  city: string;
  status: PackageStatus;
  stops: PackageStop[];
  pricing?: PackagePricing;
  rideTypes: string[];
  maxPassengers: number;
  availability: PackageAvailability;
  cancellationPolicy?: string;
  referenceOrigin?: { label: string; latitude: number; longitude: number };
  coverPath: string | null;
  revision: number;
  hasBookings: boolean;
  publishProblems: Array<{ field: string; message: string }>;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackageInput {
  name?: string;
  description?: string;
  city?: string;
  stops?: Array<{ placeId: string; name?: string }>;
  pricing?: {
    basePrice: number;
    includedDistanceKm: number;
    includedDurationHours: number;
    extraDistanceRatePerKm: number;
    extraDurationRatePerHour: number;
  };
  rideTypes?: string[];
  maxPassengers?: number;
  availability?: { days?: number[]; opensAt?: string; closesAt?: string; validFrom?: string | null; validUntil?: string | null };
  cancellationPolicy?: string;
  referenceOrigin?: { label: string; latitude: number; longitude: number };
  reason?: string;
}

export interface PlaceSuggestion {
  id: string;
  name: string;
  secondaryText: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface RoutePreview {
  legs: Array<{ from: string; to: string; distanceMeters: number; durationSeconds: number; provider: string }>;
  stopsDistanceMeters: number;
  stopsDurationSeconds: number;
  originLeg?: { distanceMeters: number; durationSeconds: number; provider: string };
  polyline?: string;
  warnings: string[];
}

export const circuitCoverUrl = (pkg: Pick<CircuitPackage, "coverPath">): string | null =>
  pkg.coverPath ? `${env.apiBaseUrl}${pkg.coverPath}` : null;

const packageKey = ["admin", "circuit-packages"] as const;

export const useCircuitPackages = (params: { status?: PackageStatus; city?: string; q?: string }) =>
  useApi<CircuitPackage[]>(packageKey, "/admin/circuit-packages", params);

export const useCircuitPackage = (id?: string) =>
  useApi<CircuitPackage>([...packageKey, id ?? "new"], `/admin/circuit-packages/${id}`, undefined, { enabled: Boolean(id) });

export const useCreateCircuitPackage = () =>
  useApiMutation((input: PackageInput) => apiClient.post<ApiSuccess<CircuitPackage>>("/admin/circuit-packages", input), [packageKey]);

export const useUpdateCircuitPackage = () =>
  useApiMutation(
    ({ id, ...input }: PackageInput & { id: string }) => apiClient.patch<ApiSuccess<CircuitPackage>>(`/admin/circuit-packages/${id}`, input),
    [packageKey, ["admin", "audit"]],
  );

export const useSetCircuitPackageStatus = () =>
  useApiMutation(
    ({ id, status, reason }: { id: string; status: PackageStatus; reason?: string }) =>
      apiClient.patch<ApiSuccess<CircuitPackage>>(`/admin/circuit-packages/${id}/status`, { status, reason }),
    [packageKey, ["admin", "audit"]],
  );

export const useDeleteCircuitPackage = () =>
  useApiMutation((id: string) => apiClient.delete<ApiSuccess<{ deleted: true }>>(`/admin/circuit-packages/${id}`), [packageKey]);

export const useUploadCircuitCover = () =>
  useApiMutation(
    ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return apiClient.put<ApiSuccess<CircuitPackage>>(`/admin/circuit-packages/${id}/cover`, form, { timeout: 60_000 });
    },
    [packageKey],
  );

export const useRemoveCircuitCover = () =>
  useApiMutation((id: string) => apiClient.delete<ApiSuccess<CircuitPackage>>(`/admin/circuit-packages/${id}/cover`), [packageKey]);

export const useRoutePreview = () =>
  useApiMutation(
    ({ id, ...body }: { id: string; stops?: Array<{ placeId: string }>; includedDistanceKm?: number }) =>
      apiClient.post<ApiSuccess<RoutePreview>>(`/admin/circuit-packages/${id}/route-preview`, body),
    [],
  );

export async function searchPlaces(q: string, sessionToken: string): Promise<{ suggestions: PlaceSuggestion[]; degraded: boolean }> {
  return (await apiClient.get<ApiSuccess<{ suggestions: PlaceSuggestion[]; degraded: boolean }>>("/admin/circuit-packages/places/autocomplete", { params: { q, sessionToken } }))
    .data.data;
}

export async function resolvePlace(id: string, sessionToken: string): Promise<{ id: string; name: string; address: string; latitude: number; longitude: number }> {
  return (await apiClient.get<ApiSuccess<{ id: string; name: string; address: string; latitude: number; longitude: number }>>("/admin/circuit-packages/places/resolve", { params: { id, sessionToken } }))
    .data.data;
}

// ── Bookings ───────────────────────────────────────────────────────────

export type StopStatus = "UPCOMING" | "ARRIVING" | "ARRIVED" | "WAITING" | "COMPLETED" | "SKIPPED";

export interface CircuitView {
  packageId: string;
  packageCode: string;
  name: string;
  city: string;
  passengers: number;
  stops: Array<PackageStop & { status: StopStatus; arrivedAt?: string; waitingAt?: string; completedAt?: string; skippedAt?: string }>;
  currentStop?: PackageStop & { status: StopStatus };
  currentStopOrder: number;
  readyToComplete: boolean;
  pricing: {
    basePrice: number;
    includedDistanceMeters: number;
    includedDurationSeconds: number;
    extraDistanceRatePerKm: number;
    extraDurationRatePerHour: number;
  };
  usage: {
    distanceMeters: number;
    distanceReliable: boolean;
    elapsedSeconds: number;
    remainingSeconds: number;
    remainingDistanceMeters: number;
    serverTime: string;
  };
  projected: { basePrice: number; extraKm: number; extraDistanceCharge: number; extraBlocks: number; extraDurationCharge: number; total: number };
  settlement?: { usedDistanceMeters: number; usedDurationSeconds: number; distanceSource: string; extraKm: number; extraBlocks: number; completedBy: string };
  exception?: { type: string; stopOrder: number; note?: string; reportedAt: string };
  cancellationPolicy?: string;
  endedEarlyReason?: string;
}

export type CircuitRide = RideBase & {
  kind: "CIRCUIT";
  circuit: CircuitView;
  fare: RideBase["fare"] & { final?: { baseFare: number; distanceCharge: number; timeCharge: number; total: number; payable: number; distanceSource: string } };
};

interface PersonRef {
  id: string;
  name: string;
  phone: string;
}

export interface CircuitBooking extends CircuitRide {
  customer: PersonRef | null;
  driver: (PersonRef & { driverId: string; driverCode: string }) | null;
  driverLocation?: { latitude: number; longitude: number; updatedAt: string; fresh: boolean };
}

export interface CircuitBookingDetail extends Omit<RideDetail, "ride"> {
  ride: RideDetail["ride"] & CircuitRide;
  timeline: Array<{
    id: string;
    type: string;
    actorType: string;
    actorId?: string;
    stopOrder?: number;
    fromState?: string;
    toState?: string;
    note?: string;
    data?: Record<string, unknown>;
    at: string;
  }>;
}

export interface CircuitBookingFilters {
  page: number;
  status?: string;
  packageId?: string;
  city?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  q?: string;
}

export interface CircuitReport {
  bookings: { total: number; completed: number; cancelled: number; noDriver: number; active: number; paymentPending: number };
  revenue: { gross: number; packageRevenue: number; extraDistanceRevenue: number; extraTimeRevenue: number; discounts: number; refunds: number };
  operations: { averageDurationSeconds: number; averageDistanceMeters: number; averageStopsCompleted: number; completedStopsTotal: number };
  packages: Array<{
    packageId: string;
    code: string;
    name: string;
    city: string;
    bookings: number;
    completed: number;
    cancelled: number;
    revenue: number;
    averageDurationSeconds: number;
    averageDistanceMeters: number;
  }>;
}

const bookingKey = ["admin", "circuit-rides"] as const;
const LIVE_REFRESH_MS = 10_000;

export const useCircuitBookings = (filters: CircuitBookingFilters) =>
  useApi<Page<CircuitBooking>>([...bookingKey, "list"], "/admin/circuit-rides", { ...filters, limit: 25 }, { refetchInterval: LIVE_REFRESH_MS });

export const useLiveCircuits = () =>
  useApi<CircuitBooking[]>([...bookingKey, "live"], "/admin/circuit-rides/live", undefined, { refetchInterval: 5_000 });

export const useCircuitBooking = (id: string) =>
  useApi<CircuitBookingDetail>([...bookingKey, "detail", id], `/admin/circuit-rides/${id}`, undefined, { refetchInterval: LIVE_REFRESH_MS });

export const useCircuitReport = (range: { startDate?: string; endDate?: string }) =>
  useApi<CircuitReport>([...bookingKey, "report"], "/admin/circuit-rides/report", range);

export const useResolveCircuitException = () =>
  useApiMutation(
    ({ id, resolution, note }: { id: string; resolution: "CONTINUE" | "SKIP_STOP"; note: string }) =>
      apiClient.post<ApiSuccess<CircuitBookingDetail>>(`/admin/circuit-rides/${id}/exceptions/resolve`, { resolution, note }),
    [bookingKey, ["admin", "rides"]],
  );

export const useEndCircuit = () =>
  useApiMutation(
    ({ id, reason }: { id: string; reason: string }) => apiClient.post<ApiSuccess<CircuitBookingDetail>>(`/admin/circuit-rides/${id}/end`, { reason }),
    [bookingKey, ["admin", "rides"]],
  );

export const useCancelCircuit = () =>
  useApiMutation(
    ({ id, reason }: { id: string; reason: string }) => apiClient.post<ApiSuccess<CircuitBookingDetail>>(`/admin/circuit-rides/${id}/cancel`, { reason }),
    [bookingKey, ["admin", "rides"]],
  );

// ── Formatting ─────────────────────────────────────────────────────────

/** "2h 14m" */
export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return "—";
  const negative = seconds < 0;
  const total = Math.abs(Math.round(seconds / 60));
  const text = total >= 60 ? `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m` : `${total}m`;
  return negative ? `−${text}` : text;
}

export function stopsDone(circuit: CircuitView): number {
  return circuit.stops.filter((stop) => stop.status === "COMPLETED" || stop.status === "SKIPPED").length;
}
