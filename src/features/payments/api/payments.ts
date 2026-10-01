import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";
import type { Page } from "@/features/rides/api/rides";
import type { Adjustment } from "@/features/earnings/api/earnings";

export const PAYMENT_STATUSES = [
  "CREATED",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Mirrors RidePaymentStatus on the server. */
export type RidePaymentStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "ORDER_CREATED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

interface Person {
  id: string;
  name: string;
  phone: string;
}

export interface PaymentListItem {
  id: string;
  rideId: string;
  rideCode: string;
  gateway: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  ridePaymentStatus: RidePaymentStatus;
  method?: string;
  methodDetails?: { bank?: string; wallet?: string; cardNetwork?: string; cardType?: string; cardLast4?: string };
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  failureReason?: string;
  paidAt?: string;
  /** Customer money refunded (processed) and on its way. */
  refund?: { refundId?: string; amount: number; pending: number; status?: PaymentRefundState; refundedAt?: string };
  createdAt: string;
  updatedAt: string;
  customer: Person | null;
  driver: (Person & { driverId: string; driverCode: string }) | null;
  attempts: number;
  needsAttention: boolean;
}

/** The final bill frozen at ride completion. */
export interface FinalFare {
  distanceMeters: number;
  durationSeconds: number;
  distanceSource: "ACTUAL" | "BOOKED";
  durationSource: "ACTUAL" | "BOOKED";
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  subtotal: number;
  minimumFareApplied: boolean;
  capApplied: boolean;
  total: number;
  discount: number;
  payable: number;
  pricingVersion: number;
}

export type PaymentRefundState = "NONE" | "PENDING" | "PARTIAL" | "FULL" | "FAILED";
export type RefundStatus = "REQUESTED" | "PENDING" | "PROCESSED" | "FAILED";
export type RefundTarget = "PAYMENT" | "DUPLICATE_CAPTURE";
export type RefundDriverImpact = "PROPORTIONAL" | "NONE";

export const REFUND_REASONS = [
  "FARE_ADJUSTMENT",
  "RIDE_CANCELLED",
  "CUSTOMER_SUPPORT",
  "ADMIN_REFUND",
  "SYSTEM_ERROR",
  "DUPLICATE_PAYMENT",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number] | "EXTERNAL";

export const REFUND_REASON_LABELS: Record<RefundReason, string> = {
  FARE_ADJUSTMENT: "Fare adjustment",
  RIDE_CANCELLED: "Ride cancelled",
  CUSTOMER_SUPPORT: "Customer support goodwill",
  ADMIN_REFUND: "Admin refund",
  SYSTEM_ERROR: "System error",
  DUPLICATE_PAYMENT: "Duplicate payment",
  EXTERNAL: "Razorpay dashboard",
};

/** Mirrors DEFAULT_DRIVER_IMPACT on the server. */
export const DEFAULT_DRIVER_IMPACT: Record<RefundReason, RefundDriverImpact> = {
  FARE_ADJUSTMENT: "PROPORTIONAL",
  RIDE_CANCELLED: "PROPORTIONAL",
  ADMIN_REFUND: "PROPORTIONAL",
  CUSTOMER_SUPPORT: "NONE",
  SYSTEM_ERROR: "NONE",
  DUPLICATE_PAYMENT: "NONE",
  EXTERNAL: "NONE",
};

export interface Refund {
  id: string;
  paymentId: string;
  rideId: string;
  rideCode: string;
  target: RefundTarget;
  razorpayPaymentId: string;
  razorpayRefundId?: string;
  amount: number;
  currency: string;
  reason: RefundReason;
  note?: string;
  driverImpact: RefundDriverImpact;
  status: RefundStatus;
  failureReason?: string;
  acquirerReference?: string;
  speedProcessed?: string;
  source: "ADMIN" | "WEBHOOK" | "RECONCILE";
  requestedBy?: { id: string; name: string };
  ledgerState: "PENDING" | "RECORDED" | "NOT_APPLICABLE";
  adjustment?: { id: string; amount?: number; status?: string };
  needsReview: boolean;
  createdAt: string;
  processedAt?: string;
  failedAt?: string;
}

export interface RefundListItem extends Refund {
  customer: { name: string; phone?: string } | null;
}

export interface PaymentDetail extends PaymentListItem {
  ride: {
    id: string;
    rideCode: string;
    status: string;
    rideType: string;
    pickupAddress: string;
    destinationAddress: string;
    completedAt?: string;
    finalFare?: number;
    estimatedFare: number;
    discount?: number;
    payableFare?: number;
    final?: FinalFare;
  } | null;
  /** Still refundable (rupees). */
  refundable: number;
  refunds: Refund[];
  adjustments: Adjustment[];
  attemptLog: Array<{
    orderId: string;
    amount: number;
    status: "CREATED" | "ATTEMPTED" | "PAID" | "FAILED";
    razorpayPaymentId?: string;
    failureCode?: string;
    failureReason?: string;
    createdAt?: string;
  }>;
  events: Array<{
    type: string;
    source: string;
    at: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    detail?: string;
    fromStatus?: string;
    toStatus?: string;
    actorId?: string;
    amount?: number;
    refundId?: string;
  }>;
  duplicateCaptures: Array<{
    razorpayPaymentId: string;
    razorpayOrderId?: string;
    amount: number;
    detectedAt: string;
    refunded: number;
    refundState: PaymentRefundState;
  }>;
  earning: {
    id: string;
    grossFare: number;
    commissionRate: number;
    commissionAmount: number;
    netEarning: number;
    status: string;
  } | null;
}

/** RAZORPAY (online) or CASH (paid to the driver). */
export type PaymentGateway = "RAZORPAY" | "CASH";

export interface PaymentsSummary {
  currency: string;
  /** Online (Razorpay) only — cash stays with drivers. */
  collectedToday: number;
  capturedToday: number;
  collectedTotal: number;
  capturedTotal: number;
  cashToday: number;
  cashRidesToday: number;
  cashTotal: number;
  cashRidesTotal: number;
  /** Commission on cash rides that drivers owe Tirvona. */
  commissionDue: number;
  commissionTotal: number;
  failedToday: number;
  outstandingRides: number;
  outstandingAmount: number;
  /** Payments with a duplicate capture not yet refunded. */
  needsAttention: number;
  refundedToday: number;
  refundedTotal: number;
  refundsPending: number;
  refundsFailed: number;
  refundsToReview: number;
  deductionsOutstanding: number;
}

export interface PaymentFilters {
  page: number;
  status?: PaymentStatus;
  gateway?: PaymentGateway;
  from?: string;
  to?: string;
  ride?: string;
  customer?: string;
  driver?: string;
  payment?: string;
}

const keys = {
  all: ["admin", "payments"] as const,
  list: (filters: PaymentFilters) => [...keys.all, "list", filters] as const,
  summary: () => [...keys.all, "summary"] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
  refunds: (filters: RefundFilters) => [...keys.all, "refunds", filters] as const,
  exceptions: () => [...keys.all, "exceptions"] as const,
  runs: (page: number) => [...keys.all, "runs", page] as const,
  run: (id: string) => [...keys.all, "run", id] as const,
};

const REFRESH_MS = 15_000;
const blankToUndefined = (value?: string) => (value && value.trim() ? value.trim() : undefined);

export function usePayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<PaymentListItem>>>("/admin/payments", {
          params: {
            page: filters.page,
            limit: 25,
            status: filters.status,
            gateway: filters.gateway,
            from: blankToUndefined(filters.from),
            to: blankToUndefined(filters.to),
            ride: blankToUndefined(filters.ride),
            customer: blankToUndefined(filters.customer),
            driver: blankToUndefined(filters.driver),
            payment: blankToUndefined(filters.payment),
          },
        })
      ).data.data,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
}

export function usePaymentsSummary() {
  return useQuery({
    queryKey: keys.summary(),
    queryFn: async () => (await apiClient.get<ApiSuccess<PaymentsSummary>>("/admin/payments/summary")).data.data,
    refetchInterval: REFRESH_MS,
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await apiClient.get<ApiSuccess<PaymentDetail>>(`/admin/payments/${id}`)).data.data,
    // Poll while money is moving: an open payment or a refund on its way.
    refetchInterval: (query) =>
      query.state.data &&
      (["CREATED", "AUTHORIZED"].includes(query.state.data.status) || (query.state.data.refund?.pending ?? 0) > 0)
        ? 5_000
        : false,
  });
}

export interface CreateRefundInput {
  paymentId: string;
  /** Rupees; omit for a full refund of what remains. */
  amount?: number;
  reason: RefundReason;
  note: string;
  driverImpact?: RefundDriverImpact;
  target?: RefundTarget;
  razorpayPaymentId?: string;
  /** One per dialog: a retried submit can never refund twice. */
  idempotencyKey: string;
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, ...body }: CreateRefundInput) =>
      (await apiClient.post<ApiSuccess<Refund>>(`/admin/payments/${paymentId}/refunds`, body)).data.data,
    // A rejected refund is recorded too: refresh either way.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all }),
        queryClient.invalidateQueries({ queryKey: ["admin", "earnings"] }),
      ]),
  });
}

export function useReviewRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ refundId, driverImpact, note }: { refundId: string; driverImpact: RefundDriverImpact; note: string }) =>
      (await apiClient.post<ApiSuccess<Refund>>(`/admin/payments/refunds/${refundId}/review`, { driverImpact, note })).data.data,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all }),
        queryClient.invalidateQueries({ queryKey: ["admin", "earnings"] }),
      ]),
  });
}

export interface RefundFilters {
  page: number;
  status?: RefundStatus;
  needsReview?: boolean;
}

export function useRefunds(filters: RefundFilters) {
  return useQuery({
    queryKey: keys.refunds(filters),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<RefundListItem>>>("/admin/payments/refunds", {
          params: { page: filters.page, limit: 25, status: filters.status, needsReview: filters.needsReview },
        })
      ).data.data,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
}

// ── Reconciliation ──────────────────────────────────────────────────────

export type ExceptionSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface PaymentException {
  kind:
    | "DUPLICATE_UNREFUNDED"
    | "WEBHOOK_FLAGGED"
    | "WEBHOOK_FAILED"
    | "REFUND_FAILED"
    | "REFUND_STUCK"
    | "REFUND_REVIEW"
    | "EARNING_MISSING"
    | "PROCESSING_STALE"
    | "LEDGER_PENDING"
    | "RUN_EXCEPTION";
  severity: ExceptionSeverity;
  paymentId?: string;
  rideCode?: string;
  reference?: string;
  amount?: number;
  detail: string;
  at: string;
  runId?: string;
  exceptionId?: string;
}

export interface ReconciliationRun {
  id: string;
  key: string;
  trigger: "ADMIN" | "DAILY";
  from: string;
  to: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  finishedAt?: string;
  stats: {
    gatewayPayments: number;
    ridePayments: number;
    foreignPayments: number;
    matched: number;
    recordedChecked: number;
    exceptions: number;
    healed: number;
    gatewayCaptured: number;
    recordedCaptured: number;
  };
  unresolved: number;
  truncated: boolean;
  error?: string;
  exceptions?: Array<{
    id: string;
    type: string;
    severity: ExceptionSeverity;
    paymentId?: string;
    rideCode?: string;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    expected?: string;
    actual?: string;
    detail: string;
    healed: boolean;
    resolvedAt?: string;
    resolutionNote?: string;
  }>;
}

export interface PaymentExceptions {
  counts: Record<ExceptionSeverity, number>;
  items: PaymentException[];
  lastRun: ReconciliationRun | null;
}

export function usePaymentExceptions() {
  return useQuery({
    queryKey: keys.exceptions(),
    queryFn: async () => (await apiClient.get<ApiSuccess<PaymentExceptions>>("/admin/payments/exceptions")).data.data,
    refetchInterval: 30_000,
  });
}

export function useReconciliationRuns(page: number) {
  return useQuery({
    queryKey: keys.runs(page),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<ReconciliationRun>>>("/admin/payments/reconciliation/runs", {
          params: { page, limit: 10 },
        })
      ).data.data,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.items.some((run) => run.status === "RUNNING") ? 2_000 : 30_000),
  });
}

export function useReconciliationRun(id?: string) {
  return useQuery({
    queryKey: keys.run(id ?? ""),
    queryFn: async () =>
      (await apiClient.get<ApiSuccess<ReconciliationRun>>(`/admin/payments/reconciliation/runs/${id}`)).data.data,
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === "RUNNING" ? 2_000 : false),
  });
}

export function useStartReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { from: string; to?: string }) =>
      (await apiClient.post<ApiSuccess<ReconciliationRun>>("/admin/payments/reconciliation/runs", body)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useResolveException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, exceptionId, note }: { runId: string; exceptionId: string; note: string }) =>
      (
        await apiClient.post<ApiSuccess<ReconciliationRun>>(
          `/admin/payments/reconciliation/runs/${runId}/exceptions/${exceptionId}/resolve`,
          { note },
        )
      ).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useReconcilePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<ApiSuccess<PaymentDetail>>(`/admin/payments/${id}/reconcile`)).data.data,
    onSuccess: (detail) => {
      queryClient.setQueryData(keys.detail(detail.id), detail);
      return queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });
}

// ── Commission ──────────────────────────────────────────────────────────

export type CommissionPhase = "SCHEDULED" | "CURRENT" | "SUPERSEDED" | "CANCELLED";

export interface Commission {
  id: string;
  version: number;
  type: "PERCENTAGE";
  value: number;
  effectiveFrom: string;
  status: "ACTIVE" | "CANCELLED";
  phase: CommissionPhase;
  note?: string;
  createdBy?: string;
  createdAt: string;
  cancelledAt?: string;
}

const commissionKey = ["admin", "commission"] as const;

export function useCommission() {
  return useQuery({
    queryKey: [...commissionKey, "current"],
    queryFn: async () =>
      (await apiClient.get<ApiSuccess<{ current: Commission; scheduled: Commission[] }>>("/admin/commission")).data.data,
  });
}

export function useCommissionHistory() {
  return useQuery({
    queryKey: [...commissionKey, "history"],
    queryFn: async () => (await apiClient.get<ApiSuccess<Commission[]>>("/admin/commission/history")).data.data,
  });
}

export function useUpdateCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { value: number; effectiveFrom?: string; note?: string }) =>
      (await apiClient.patch<ApiSuccess<Commission>>("/admin/commission", { type: "PERCENTAGE", ...body })).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commissionKey }),
  });
}

export function useCancelCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<ApiSuccess<Commission>>(`/admin/commission/${id}/cancel`)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commissionKey }),
  });
}
