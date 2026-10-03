/**
 * Phase 7 admin APIs: customers, vehicles, ride types, zones, promo codes,
 * cancellations, broadcasts, reports and the audit log. Types mirror the
 * NestJS responses; the server stays the authority for every rule.
 */
import { apiClient, useApi, useApiMutation } from "@/lib/api/hooks";
import type { ApiSuccess } from "@/lib/api/client";
import type { Page, RideBase, RideStatus } from "@/features/rides/api/rides";

// ── Customers ──────────────────────────────────────────────────────────

export type AccountStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: AccountStatus;
  isPhoneVerified: boolean;
  totalRides: number;
  lastLoginAt?: string;
  createdAt: string;
}

export interface CustomerDetail {
  customer: {
    id: string;
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
    status: AccountStatus;
    isPhoneVerified: boolean;
    lastLoginAt?: string;
    createdAt: string;
    statusReason?: string;
    statusChangedAt?: string;
  };
  stats: {
    totalRides: number;
    completedRides: number;
    cancelledRides: number;
    totalPaid: number;
    outstandingCancellationFees: number;
    outstandingCancellationCount: number;
    complaints: number;
  };
  activeRide: RideBase | null;
  recentRides: RideBase[];
}

const customerKey = ["admin", "customers"] as const;
export const useCustomers = (params: { page: number; search?: string; status?: AccountStatus }) =>
  useApi<Page<CustomerListItem>>([...customerKey, "list"], "/admin/customers", { ...params, limit: 25 });
export const useCustomer = (id: string) => useApi<CustomerDetail>([...customerKey, id], `/admin/customers/${id}`);
export const useSetCustomerBlocked = () =>
  useApiMutation(
    ({ id, block, reason }: { id: string; block: boolean; reason?: string }) =>
      apiClient.post<ApiSuccess<CustomerDetail>>(`/admin/customers/${id}/${block ? "block" : "unblock"}`, { reason }),
    [customerKey],
  );

// ── Vehicles ───────────────────────────────────────────────────────────

export const VEHICLE_TYPES = ["BIKE", "AUTO", "E_RICKSHAW", "CAB"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface VehicleListItem {
  id: string;
  vehicleType: VehicleType;
  registrationNumber: string;
  make?: string;
  model?: string;
  color?: string;
  manufactureYear?: number;
  isActive: boolean;
  createdAt: string;
  driver: { id: string; driverCode: string; driverStatus: string; name: string; phone: string } | null;
}

export const useVehicles = (params: { page: number; search?: string; vehicleType?: VehicleType; active?: boolean }) =>
  useApi<Page<VehicleListItem>>(["admin", "vehicles"], "/admin/vehicles", { ...params, limit: 25 });

// ── Ride types (with tariff) ───────────────────────────────────────────

export const RIDE_TYPE_ICONS = ["bike", "auto", "e_rickshaw", "cab", "cab_xl", "premium"] as const;

export interface RideTypeRow {
  rideType: {
    id: string;
    code: string;
    displayName: string;
    description?: string;
    icon: string;
    vehicleType: VehicleType;
    seatCapacity: number;
    sortOrder: number;
    isActive: boolean;
    updatedAt: string;
  };
  pricing: { baseFare: number; perKmRate: number; perMinuteRate: number; minimumFare: number; version: number } | null;
}

export interface CreateRideTypeInput {
  code: string;
  displayName: string;
  description?: string;
  icon: string;
  vehicleType: VehicleType;
  seatCapacity: number;
  sortOrder?: number;
  isActive?: boolean;
  pricing?: { baseFare: number; perKmRate: number; perMinuteRate: number; minimumFare: number };
  distance?: { minDistanceMeters: number; maxDistanceKm: number };
}

const rideTypeKey = ["admin", "ride-types"] as const;
export const useRideTypes = () => useApi<RideTypeRow[]>(rideTypeKey, "/admin/ride-types");
export const useCreateRideType = () =>
  useApiMutation((input: CreateRideTypeInput) => apiClient.post<ApiSuccess<RideTypeRow>>("/admin/ride-types", input), [rideTypeKey, ["admin", "pricing"], ["admin", "ride-distance-config"]]);
export const useUpdateRideType7 = () =>
  useApiMutation(
    ({ code, ...changes }: { code: string } & Partial<Omit<CreateRideTypeInput, "code" | "pricing" | "distance">> & { reason?: string }) =>
      apiClient.patch(`/admin/ride-types/${code}`, changes),
    [rideTypeKey, ["admin", "pricing"]],
  );
export const useSetTariff = () =>
  useApiMutation(
    ({ code, ...rates }: { code: string; baseFare: number; perKmRate: number; perMinuteRate: number; minimumFare: number }) =>
      apiClient.patch(`/admin/pricing/${code}`, rates),
    [rideTypeKey, ["admin", "pricing"]],
  );

// ── Zones ──────────────────────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Zone {
  id: string;
  name: string;
  city?: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  boundary: LatLng[];
  vertexCount: number;
  createdAt: string;
  updatedAt: string;
}

const zoneKey = ["admin", "zones"] as const;
export const useZones = (params: { page: number; search?: string; status?: Zone["status"] }) =>
  useApi<Page<Zone>>([...zoneKey, "list"], "/admin/zones", { ...params, limit: 25 });
export const useZone = (id?: string) => useApi<Zone>([...zoneKey, id ?? "new"], `/admin/zones/${id}`, undefined, { enabled: Boolean(id) });
export const useSaveZone = () =>
  useApiMutation(
    ({ id, ...body }: { id?: string; name: string; city?: string; description?: string; boundary: LatLng[] }) =>
      id ? apiClient.patch<ApiSuccess<Zone>>(`/admin/zones/${id}`, body) : apiClient.post<ApiSuccess<Zone>>("/admin/zones", body),
    [zoneKey],
  );
export const useSetZoneStatus = () =>
  useApiMutation(
    ({ id, status, reason }: { id: string; status: Zone["status"]; reason?: string }) =>
      apiClient.patch<ApiSuccess<Zone>>(`/admin/zones/${id}/status`, { status, reason }),
    [zoneKey],
  );

/** Same approximation the API's circlePoints uses — a quick "N km around here" outline. */
export function circleBoundary(center: LatLng, radiusKm: number, vertices = 32): LatLng[] {
  const latitudeKm = 110.574;
  const longitudeKm = 111.32 * Math.cos((center.latitude * Math.PI) / 180);
  return Array.from({ length: vertices }, (_, index) => {
    const angle = (2 * Math.PI * index) / vertices;
    return {
      latitude: Math.round((center.latitude + (radiusKm * Math.sin(angle)) / latitudeKm) * 1e6) / 1e6,
      longitude: Math.round((center.longitude + (radiusKm * Math.cos(angle)) / longitudeKm) * 1e6) / 1e6,
    };
  });
}

// ── Promo codes ────────────────────────────────────────────────────────

export type DiscountType = "PERCENTAGE" | "FLAT";

export interface Promo {
  id: string;
  code: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minRideValue?: number;
  usageLimit?: number;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
  status: "ACTIVE" | "INACTIVE";
  isLive: boolean;
  applicableRideTypes: string[];
  showInApp: boolean;
  usedCount: number;
  redeemedCount: number;
  discountGiven: number;
  createdAt: string;
}

export interface PromoInput {
  code?: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minRideValue?: number | null;
  usageLimit?: number | null;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
  applicableRideTypes: string[];
  showInApp: boolean;
}

export interface PromoRedemption {
  id: string;
  userId: string;
  rideId: string;
  rideType: string;
  discount: number;
  status: "RESERVED" | "REDEEMED" | "RELEASED";
  createdAt: string;
}

const promoKey = ["admin", "promotions"] as const;
export const usePromos = (params: { page: number; search?: string; status?: Promo["status"]; window?: "LIVE" | "SCHEDULED" | "EXPIRED" }) =>
  useApi<Page<Promo>>([...promoKey, "list"], "/admin/promotions", { ...params, limit: 25 });
export const usePromo = (id: string) =>
  useApi<{ promo: Promo; redemptions: PromoRedemption[] }>([...promoKey, id], `/admin/promotions/${id}`);
export const useSavePromo = () =>
  useApiMutation(
    ({ id, input }: { id?: string; input: PromoInput }) =>
      id
        ? apiClient.patch<ApiSuccess<Promo>>(`/admin/promotions/${id}`, { ...input, code: undefined })
        : apiClient.post<ApiSuccess<Promo>>("/admin/promotions", input),
    [promoKey],
  );
export const useSetPromoStatus = () =>
  useApiMutation(
    ({ id, status, reason }: { id: string; status: Promo["status"]; reason?: string }) =>
      apiClient.patch<ApiSuccess<Promo>>(`/admin/promotions/${id}/status`, { status, reason }),
    [promoKey],
  );

// ── Cancellations ──────────────────────────────────────────────────────

export type Actor = "CUSTOMER" | "DRIVER" | "ADMIN" | "SYSTEM";
export type FeeStatus = "NOT_APPLICABLE" | "DUE" | "WAIVED" | "COLLECTED";

export interface CancellationRecord {
  id: string;
  rideId: string;
  rideCode: string;
  rideType: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  cancelledBy: Actor;
  reasonCode: string;
  reasonLabel: string;
  note?: string;
  rideStatusAtCancellation: RideStatus;
  estimatedFare: number;
  feeAmount: number;
  feeStatus: FeeStatus;
  policyVersion?: number;
  cancelledAt: string;
  feeResolvedAt?: string;
  feeResolutionNote?: string;
}

export interface CancellationReason {
  code: string;
  actor: Actor;
  label: string;
  requiresNote: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CustomerFeePolicy {
  enabled: boolean;
  graceSeconds: number;
  fixedFee: number;
  percentOfFare: number;
  maxFee: number;
  applicableStatuses: Array<"DRIVER_ACCEPTED" | "DRIVER_ARRIVED">;
}

export interface CancellationPolicy {
  version: number;
  customerFee: CustomerFeePolicy;
  note?: string;
  createdAt?: string;
}

const cancellationKey = ["admin", "cancellations"] as const;
export const useCancellations = (params: { page: number; search?: string; cancelledBy?: Actor; feeStatus?: FeeStatus }) =>
  useApi<Page<CancellationRecord>>([...cancellationKey, "list"], "/admin/cancellations", { ...params, limit: 25 });
export const useCancellationReasons = () =>
  useApi<CancellationReason[]>([...cancellationKey, "reasons"], "/admin/cancellations/reasons");
export const useCancellationPolicy = () =>
  useApi<{ current: CancellationPolicy; history: CancellationPolicy[] }>([...cancellationKey, "policy"], "/admin/cancellations/policy");
export const useResolveFee = () =>
  useApiMutation(
    ({ id, status, note }: { id: string; status: "WAIVED" | "COLLECTED"; note: string }) =>
      apiClient.post<ApiSuccess<CancellationRecord>>(`/admin/cancellations/${id}/fee`, { status, note }),
    [cancellationKey, ["admin", "rides"], ["admin", "customers"]],
  );
export const useSavePolicy = () =>
  useApiMutation(
    (input: { customerFee: CustomerFeePolicy; note: string }) => apiClient.patch<ApiSuccess<CancellationPolicy>>("/admin/cancellations/policy", input),
    [cancellationKey],
  );
export const useCreateReason = () =>
  useApiMutation(
    (input: { code: string; actor: Actor; label: string; requiresNote: boolean; sortOrder?: number }) =>
      apiClient.post<ApiSuccess<CancellationReason>>("/admin/cancellations/reasons", input),
    [cancellationKey],
  );
export const useUpdateReason = () =>
  useApiMutation(
    ({ actor, code, ...changes }: { actor: Actor; code: string; label?: string; requiresNote?: boolean; isActive?: boolean; sortOrder?: number }) =>
      apiClient.patch<ApiSuccess<CancellationReason>>(`/admin/cancellations/reasons/${actor}/${code}`, changes),
    [cancellationKey],
  );

// ── Broadcasts ─────────────────────────────────────────────────────────

export const AUDIENCES = ["ALL_CUSTOMERS", "ALL_DRIVERS", "APPROVED_DRIVERS", "ALL_USERS"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const DEEP_LINKS = ["NONE", "HOME", "RIDES", "OFFERS", "NOTIFICATIONS", "SUPPORT"] as const;
export type DeepLink = (typeof DEEP_LINKS)[number];
export type BroadcastStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED" | "FAILED";

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  audience: Audience;
  deepLink: DeepLink;
  status: BroadcastStatus;
  scheduledAt?: string;
  startedAt?: string;
  sentAt?: string;
  processedCount: number;
  error?: string;
  createdByName?: string;
  createdAt: string;
}

const broadcastKey = ["admin", "broadcasts"] as const;
export const useBroadcasts = (params: { page: number; status?: BroadcastStatus }) =>
  useApi<Page<Broadcast>>([...broadcastKey, "list"], "/admin/broadcasts", { ...params, limit: 25 }, { refetchInterval: 10_000 });
export const useAudienceSize = (audience: Audience) =>
  useApi<{ audience: Audience; recipients: number }>([...broadcastKey, "audience"], "/admin/broadcasts/audience", { audience });
export const useSaveBroadcast = () =>
  useApiMutation(
    ({ id, ...body }: { id?: string; title: string; message: string; audience: Audience; deepLink: DeepLink; scheduledAt?: string | null }) =>
      id ? apiClient.patch<ApiSuccess<Broadcast>>(`/admin/broadcasts/${id}`, body) : apiClient.post<ApiSuccess<Broadcast>>("/admin/broadcasts", { ...body, scheduledAt: body.scheduledAt ?? undefined }),
    [broadcastKey],
  );
export const useBroadcastAction = () =>
  useApiMutation(({ id, action }: { id: string; action: "send" | "cancel" }) => apiClient.post<ApiSuccess<Broadcast>>(`/admin/broadcasts/${id}/${action}`), [broadcastKey]);

// ── Reports ────────────────────────────────────────────────────────────

export type Preset = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CUSTOM";
export interface RangeQuery {
  preset: Preset;
  from?: string;
  to?: string;
}
interface RangeView {
  preset: Preset;
  from: string;
  to: string;
  days: number;
  timeZone: string;
}
export interface BreakdownRow {
  key: string;
  label: string;
  requested: number;
  completed: number;
  cancelled: number;
  completedValue: number;
}

export interface OverviewReport {
  range: RangeView;
  rides: { requested: number; completed: number; cancelled: number; noDriver: number; activeNow: number };
  customers: { total: number; new: number };
  drivers: { approved: number; pendingKyc: number; onlineNow: number; availableNow: number };
  money: { completedRideValue: number; promoDiscounts: number; collected: number; driverEarnings: number; platformCommission: number; cancellationFees: number };
}
export interface RidesReport {
  range: RangeView;
  totals: { requested: number; searching: number; assigned: number; inProgress: number; completed: number; cancelled: number; noDriver: number; completionRate: number; cancellationRate: number };
  averages: { fare: number; distanceKm: number; durationMinutes: number; tripMinutes: number };
  byRideType: BreakdownRow[];
  byZone: BreakdownRow[];
  byDay: Array<{ date: string; requested: number; completed: number; cancelled: number }>;
}
export interface RevenueReport {
  range: RangeView;
  totals: Record<
    | "grossBookedValue"
    | "completedRideValue"
    | "promoDiscounts"
    | "customerPayable"
    | "collectedOnline"
    | "collectedCash"
    | "collected"
    | "refunds"
    | "cancellationFeesAssessed"
    | "cancellationFeesCollected"
    | "cancellationFeesWaived"
    | "cancellationFeesDue"
    | "driverEarnings"
    | "platformCommission"
    | "platformNetRevenue"
    | "unpaidCompletedRides"
    | "unpaidAmount",
    number
  >;
  byDay: Array<{ date: string; completedValue: number; collected: number; commission: number; discounts: number }>;
}
export interface DriversReport {
  range: RangeView;
  totals: Record<"total" | "pendingKyc" | "underReview" | "approved" | "rejected" | "suspended" | "online" | "available" | "activeInRange", number>;
  top: Array<{ driverId: string; driverCode: string; name: string; completedRides: number; cancelledRides: number; completedValue: number; netEarnings: number; ratingAverage: number; ratingCount: number }>;
}
export interface CustomersReport {
  range: RangeView;
  totals: Record<"total" | "new" | "active" | "bookings" | "completedRides" | "cancelledRides" | "averageRidesPerActiveCustomer" | "blocked", number>;
  byDay: Array<{ date: string; newCustomers: number; activeCustomers: number }>;
}
export interface CancellationsReport {
  range: RangeView;
  totals: Record<"total" | "byCustomer" | "byDriver" | "byAdmin" | "noDriverExpiries" | "cancellationRate", number>;
  fees: Record<"assessed" | "due" | "collected" | "waived" | "charged", number>;
  byReason: Array<{ actor: Actor; code: string; label: string; count: number }>;
  byStatusAtCancellation: Array<{ status: RideStatus; count: number }>;
  byDay: Array<{ date: string; customer: number; driver: number; admin: number }>;
}
export interface PromotionsReport {
  range: RangeView;
  totals: Record<"promos" | "activePromos" | "liveNow" | "applied" | "redeemed" | "released" | "discountGiven" | "promoAssistedRides" | "promoAssistedValue", number>;
  top: Array<{ code: string; title: string; redeemed: number; discount: number; applied: number }>;
}

export function useReport<T>(name: string, range: RangeQuery) {
  const params = range.preset === "CUSTOM" ? { from: range.from, to: range.to } : { preset: range.preset };
  return useApi<T>(["admin", "reports", name], `/admin/reports/${name}`, params, {
    enabled: range.preset !== "CUSTOM" || Boolean(range.from && range.to),
  });
}

// ── Audit log ──────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  adminId: string;
  adminName?: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const useAuditLog = (params: { page: number; targetType?: string; targetId?: string; action?: string }) =>
  useApi<Page<AuditEntry>>(["admin", "audit"], "/admin/audit-logs", { ...params, limit: 30 });
