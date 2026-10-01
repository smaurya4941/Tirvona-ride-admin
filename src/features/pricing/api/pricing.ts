import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";
import type { RideTypeCode } from "@/features/rides/api/rides";

export interface RideTypeSummary {
  id: string;
  code: RideTypeCode;
  displayName: string;
  description?: string;
  icon: string;
  vehicleType: string;
  seatCapacity: number;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
}

export interface PricingRates {
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
}

export interface PricingSummary extends PricingRates {
  id: string;
  rideType: RideTypeCode;
  currency: string;
  version: number;
  updatedAt: string;
}

export interface PricingRow {
  rideType: RideTypeSummary;
  pricing: PricingSummary | null;
}

const key = ["admin", "pricing"] as const;

export function usePricing() {
  return useQuery({
    queryKey: key,
    queryFn: async () => (await apiClient.get<ApiSuccess<PricingRow[]>>("/admin/pricing")).data.data,
  });
}

export function useUpdatePricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rideType, rates }: { rideType: RideTypeCode; rates: Partial<PricingRates> }) =>
      (await apiClient.patch<ApiSuccess<PricingSummary>>(`/admin/pricing/${rideType}`, rates)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateRideType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rideType, isActive }: { rideType: RideTypeCode; isActive: boolean }) =>
      (await apiClient.patch<ApiSuccess<RideTypeSummary>>(`/admin/ride-types/${rideType}`, { isActive })).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/**
 * Mirror of the server's FareCalculator for the admin preview only — actual
 * fares are always computed by the API. Works in paise like the server.
 */
export function previewFare(rates: PricingRates, distanceKm: number, minutes: number) {
  const paise = (rupees: number) => Math.round(rupees * 100);
  const distanceCharge = Math.round(paise(rates.perKmRate) * distanceKm);
  const timeCharge = Math.round(paise(rates.perMinuteRate) * minutes);
  const subtotal = paise(rates.baseFare) + distanceCharge + timeCharge;
  const minimumApplied = subtotal < paise(rates.minimumFare);
  const total = Math.round(Math.max(subtotal, paise(rates.minimumFare)) / 100);
  return {
    distanceCharge: distanceCharge / 100,
    timeCharge: timeCharge / 100,
    subtotal: subtotal / 100,
    minimumApplied,
    total,
  };
}
