import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";

export interface PeakSlot {
  id: string;
  name: string;
  /** HH:mm, business time zone. Inclusive. */
  startTime: string;
  /** HH:mm, exclusive. Earlier than the start = crosses midnight. */
  endTime: string;
  crossesMidnight: boolean;
  hikePercent: number;
  appliesToAll: boolean;
  rideTypes: string[];
  isActive: boolean;
  /** Active and the server clock is inside the window. */
  isLive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PeakSlotInput {
  name: string;
  startTime: string;
  endTime: string;
  hikePercent: number;
  appliesToAll: boolean;
  rideTypes: string[];
  isActive: boolean;
}

export interface PeakStatusRow {
  rideType: string;
  displayName: string;
  isActive: boolean;
  hasTariff: boolean;
  basePerKmRate?: number;
  currentPerKmRate?: number;
  peak?: { slotId: string; name: string; hikePercent: number; startTime: string; endTime: string };
}

export interface PeakStatus {
  timeZone: string;
  now: string;
  isPeak: boolean;
  rideTypes: PeakStatusRow[];
}

const root = ["admin", "peak-pricing"] as const;

export function usePeakSlots() {
  return useQuery({
    queryKey: [...root, "list"],
    queryFn: async () =>
      (await apiClient.get<ApiSuccess<{ timeZone: string; items: PeakSlot[] }>>("/admin/peak-pricing")).data.data,
    // "Live now" badges follow the clock.
    refetchInterval: 30_000,
  });
}

export function usePeakStatus() {
  return useQuery({
    queryKey: [...root, "status"],
    queryFn: async () => (await apiClient.get<ApiSuccess<PeakStatus>>("/admin/peak-pricing/status")).data.data,
    refetchInterval: 30_000,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: root });
}

export function useSavePeakSlot() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: PeakSlotInput }) =>
      id
        ? (await apiClient.patch<ApiSuccess<PeakSlot>>(`/admin/peak-pricing/${id}`, input)).data.data
        : (await apiClient.post<ApiSuccess<PeakSlot>>("/admin/peak-pricing", input)).data.data,
    onSuccess: invalidate,
  });
}

export function useSetPeakSlotActive() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await apiClient.patch<ApiSuccess<PeakSlot>>(`/admin/peak-pricing/${id}/status`, { isActive })).data.data,
    onSuccess: invalidate,
  });
}

export function useDeletePeakSlot() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<ApiSuccess<{ deleted: true }>>(`/admin/peak-pricing/${id}`)).data.data,
    onSuccess: invalidate,
  });
}

/** "16:00" → "4:00 PM". */
export function formatClock(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

export const formatWindow = (slot: Pick<PeakSlot, "startTime" | "endTime">) =>
  `${formatClock(slot.startTime)} – ${formatClock(slot.endTime)}`;

/**
 * Preview only (the API rounds the same way): the per-km rate with the hike
 * applied, to the paisa. Fares themselves are always calculated by the server.
 */
export function previewPerKm(perKmRate: number, hikePercent: number): number {
  return Math.round((Math.round(perKmRate * 100) * (10_000 + Math.round(hikePercent * 100))) / 10_000) / 100;
}
