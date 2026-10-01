import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";
import type { Page } from "@/features/rides/api/rides";

/** COLLECTED: a cash ride — the driver kept the fare, nothing to pay out. */
export type EarningStatus = "PENDING" | "AVAILABLE" | "PAID" | "COLLECTED";

export interface DriverRef {
  driverId: string;
  userId: string;
  driverCode: string;
  name: string;
  phone: string;
}

export interface Balances {
  pending: number;
  available: number;
  paid: number;
  /** Driver's share of cash fares, already in hand. */
  collected: number;
  /** Tirvona's commission on cash fares, owed by the driver. */
  commissionDue: number;
  /** Refund clawbacks still to be deducted from the next payout. */
  deductions: number;
}

export type AdjustmentStatus = "OUTSTANDING" | "SETTLED" | "WAIVED";

/** A refund clawback: the driver's share of a customer refund. */
export interface Adjustment {
  id: string;
  type: "REFUND_CLAWBACK";
  earningId: string;
  rideId: string;
  rideCode: string;
  paymentId: string;
  refundId: string;
  reason: string;
  currency: string;
  refundAmount: number;
  grossReversal: number;
  commissionReversal: number;
  /** Deducted from the driver. */
  amount: number;
  commissionRate: number;
  status: AdjustmentStatus;
  payoutId?: string;
  settledAt?: string;
  waiverNote?: string;
  createdAt: string;
}

export interface PayoutPreview {
  earningCount: number;
  grossAmount: number;
  deductionAmount: number;
  adjustmentCount: number;
  amount: number;
  outstandingDeductions: number;
}

export interface DriverEarningsRow extends Balances {
  driver: DriverRef;
  rides: number;
  gross: number;
  commission: number;
  net: number;
  lastEarningAt?: string;
}

export interface EarningsTotals extends Balances {
  currency: string;
  rides: number;
  gross: number;
  commission: number;
  net: number;
  drivers: number;
}

export interface Earning {
  id: string;
  rideId: string;
  rideCode: string;
  rideType: string;
  paymentId: string;
  pickupAddress?: string;
  destinationAddress?: string;
  rideCompletedAt: string;
  currency: string;
  grossFare: number;
  commissionType: "PERCENTAGE";
  commissionRate: number;
  commissionAmount: number;
  netEarning: number;
  paymentMode: "ONLINE" | "CASH";
  paymentMethod?: string;
  status: EarningStatus;
  availableAt: string;
  payoutId?: string;
  paidAt?: string;
  payoutReference?: string;
  payoutNote?: string;
  createdAt: string;
}

export interface Payout {
  id: string;
  driverId: string;
  earningIds: string[];
  earningCount: number;
  /** Earnings settled, before deductions. */
  grossAmount: number;
  /** Refund clawbacks recovered in this payout. */
  deductionAmount: number;
  adjustmentIds: string[];
  /** Transferred to the driver. */
  amount: number;
  currency: string;
  payoutReference: string;
  note?: string;
  paidBy: { id: string; name: string };
  paidAt: string;
}

export interface DriverEarningsDetail {
  driver: DriverRef;
  summary: DriverEarningsRow;
  ledger: Page<Earning>;
  payouts: Payout[];
  adjustments: Adjustment[];
}

const keys = {
  all: ["admin", "earnings"] as const,
  list: (page: number, search?: string) => [...keys.all, "list", page, search] as const,
  totals: () => [...keys.all, "totals"] as const,
  driver: (driverId: string, page: number, status?: EarningStatus) =>
    [...keys.all, "driver", driverId, page, status] as const,
};

export function useEarningsTotals() {
  return useQuery({
    queryKey: keys.totals(),
    queryFn: async () => (await apiClient.get<ApiSuccess<EarningsTotals>>("/admin/earnings/summary")).data.data,
  });
}

export function useDriverEarningsList(page: number, search?: string) {
  return useQuery({
    queryKey: keys.list(page, search),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<DriverEarningsRow>>>("/admin/earnings", {
          params: { page, limit: 25, search: search || undefined },
        })
      ).data.data,
    placeholderData: keepPreviousData,
  });
}

export function useDriverEarnings(driverId: string, page: number, status?: EarningStatus) {
  return useQuery({
    queryKey: keys.driver(driverId, page, status),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<DriverEarningsDetail>>(`/admin/earnings/${driverId}`, {
          params: { page, limit: 50, status },
        })
      ).data.data,
    placeholderData: keepPreviousData,
  });
}

export function useCreatePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { driverId: string; earningIds: string[]; payoutReference: string; note?: string }) =>
      (await apiClient.post<ApiSuccess<Payout>>("/admin/earnings/payouts", body)).data.data,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all }),
        queryClient.invalidateQueries({ queryKey: ["admin", "payments"] }),
      ]),
  });
}

/** What paying the selected lines would transfer after refund deductions. */
export function usePayoutPreview(driverId: string, earningIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: [...keys.all, "preview", driverId, [...earningIds].sort().join(",")],
    queryFn: async () =>
      (await apiClient.post<ApiSuccess<PayoutPreview>>("/admin/earnings/payouts/preview", { driverId, earningIds })).data.data,
    enabled: enabled && earningIds.length > 0,
  });
}

export function useWaiveAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) =>
      (await apiClient.post<ApiSuccess<Adjustment>>(`/admin/earnings/adjustments/${id}/waive`, { note })).data.data,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.all }),
        queryClient.invalidateQueries({ queryKey: ["admin", "payments"] }),
      ]),
  });
}
