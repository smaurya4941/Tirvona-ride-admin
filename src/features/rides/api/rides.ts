import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";
import type { RidePaymentStatus } from "@/features/payments/api/payments";

export const RIDE_STATUSES = [
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_ACCEPTED",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "COMPLETED",
  "CANCELLED",
  "NO_DRIVER_AVAILABLE",
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

/** The seeded V1 ride types. Codes are data since Phase 7 (admins can add more). */
export const RIDE_TYPES = ["BIKE", "AUTO", "E_RICKSHAW", "CAB"] as const;
export type RideTypeCode = string;

export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = [
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_ACCEPTED",
  "DRIVER_ARRIVED",
];
/** Mirrors CUSTOMER_CANCELLABLE_STATUSES on the server. */
export const ADMIN_CANCELLABLE: readonly RideStatus[] = ACTIVE_RIDE_STATUSES;

export type ActorType = "CUSTOMER" | "DRIVER" | "ADMIN" | "SYSTEM";

export interface RideLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export interface RideFare {
  currency: string;
  baseFare: number;
  perKmRate: number;
  /** The permanent per-km rate; `perKmRate` is higher while a peak applied to this ride. */
  basePerKmRate?: number;
  /** The peak-hour slot that raised this ride's per-km rate, frozen at booking. */
  peak?: { name: string; hikePercent: number; startTime: string; endTime: string; surcharge: number };
  perMinuteRate: number;
  minimumFare: number;
  distanceCharge: number;
  timeCharge: number;
  subtotal: number;
  minimumFareApplied: boolean;
  estimatedFare: number;
  finalFare?: number;
  discount?: number;
  payableFare?: number;
}

export interface RideBase {
  id: string;
  rideCode: string;
  status: RideStatus;
  rideType: RideTypeCode;
  vehicleType: string;
  pickup: RideLocation;
  destination: RideLocation;
  distanceMeters: number;
  durationSeconds: number;
  routeProvider: string;
  fare: RideFare;
  requestedAt: string;
  assignedAt?: string;
  acceptedAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
  cancellation?: {
    cancelledBy: ActorType;
    reason?: string;
    reasonCode?: string;
    feeAmount?: number;
    feeStatus?: "NOT_APPLICABLE" | "DUE" | "WAIVED" | "COLLECTED";
  };
  promo?: { code: string; title: string; discount: number };
  zone?: { id: string; name: string };
  paymentStatus: RidePaymentStatus;
  payment?: { paymentId: string; gatewayPaymentId?: string; method?: string; amount?: number; paidAt?: string; failureReason?: string };
}

interface PersonRef {
  id: string;
  name: string;
  phone: string;
}

export interface RideListItem extends RideBase {
  customer: PersonRef | null;
  driver: (PersonRef & { driverId: string; driverCode: string }) | null;
}

export interface RideDetail {
  ride: RideBase & {
    pricingVersion: number;
    dispatchCount: number;
    rejectedDriverCount: number;
    driverDistanceMeters?: number;
    assignmentExpiresAt?: string;
    searchExpiresAt: string;
    otp: { issued: boolean; attempts: number; expiresAt?: string; verifiedAt?: string };
    vehicle?: {
      vehicleId?: string;
      vehicleType: string;
      registrationNumber: string;
      make?: string;
      model?: string;
      color?: string;
    };
    createdAt: string;
    updatedAt: string;
  };
  customer: PersonRef | null;
  driver: (PersonRef & { driverId: string; driverCode: string; ratingAverage: number; totalRides: number }) | null;
  history: Array<{
    id: string;
    fromStatus?: RideStatus;
    toStatus: RideStatus;
    actorType: ActorType;
    actorId?: string;
    actorName?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }>;
  /** Coarse driver location checkpoints — lifecycle points plus a sparse trail, never every GPS ping. */
  checkpoints: Array<{
    kind: "ACCEPTED" | "ARRIVING" | "ARRIVED" | "STARTED" | "TRIP" | "COMPLETED" | "CANCELLED";
    latitude: number;
    longitude: number;
    source: "LIVE" | "LAST_KNOWN";
    recordedAt: string;
  }>;
  cancellation: {
    id: string;
    reasonCode: string;
    reasonLabel: string;
    note?: string;
    cancelledBy: ActorType;
    rideStatusAtCancellation: RideStatus;
    feeAmount: number;
    feeStatus: "NOT_APPLICABLE" | "DUE" | "WAIVED" | "COLLECTED";
    policyVersion?: number;
    feeResolutionNote?: string;
  } | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface RideListFilters {
  page: number;
  status?: RideStatus;
  rideType?: RideTypeCode;
  search?: string;
}

const keys = {
  all: ["admin", "rides"] as const,
  list: (filters: RideListFilters) => [...keys.all, "list", filters] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
};

// Rides move on their own (matching, drivers, timeouts), so operator views
// refresh themselves; polling pauses while the tab is hidden.
const LIVE_REFRESH_MS = 10_000;

export function useRides(filters: RideListFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<RideListItem>>>("/admin/rides", {
          params: { ...filters, limit: 25, search: filters.search || undefined },
        })
      ).data.data,
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useRide(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await apiClient.get<ApiSuccess<RideDetail>>(`/admin/rides/${id}`)).data.data,
    refetchInterval: (query) =>
      query.state.data && ACTIVE_RIDE_STATUSES.concat("RIDE_STARTED").includes(query.state.data.ride.status)
        ? LIVE_REFRESH_MS
        : false,
  });
}

export function useCancelRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, reasonCode }: { id: string; reason: string; reasonCode?: string }) =>
      apiClient.post(`/admin/rides/${id}/cancel`, { reason, reasonCode }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      ]),
  });
}
