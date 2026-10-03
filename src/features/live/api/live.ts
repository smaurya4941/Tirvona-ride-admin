import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";

export interface LiveDriver {
  driverId: string;
  driverCode: string;
  name: string;
  phone: string;
  driverStatus: string;
  isOnline: boolean;
  isAvailable: boolean;
  vehicle?: { vehicleType: string; registrationNumber: string; make?: string; model?: string; color?: string };
  ride?: { rideId: string; rideCode: string; status: string };
  location?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    updatedAt: string;
    source: "live" | "saved";
    fresh: boolean;
  };
}

export interface LiveDriversReport {
  generatedAt: string;
  staleAfterSeconds: number;
  truncated: boolean;
  items: LiveDriver[];
}

/** How often the panel asks for new positions (paused while the tab is hidden). */
export const LIVE_REFRESH_MS = 5_000;

export function useLiveDrivers() {
  return useQuery({
    queryKey: ["admin", "live", "drivers"],
    queryFn: async () => (await apiClient.get<ApiSuccess<LiveDriversReport>>("/admin/live/drivers")).data.data,
    refetchInterval: LIVE_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

export function useLiveDriver(driverId: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "live", "driver", driverId],
    queryFn: async () => (await apiClient.get<ApiSuccess<LiveDriver>>(`/admin/live/drivers/${driverId}`)).data.data,
    enabled: enabled && Boolean(driverId),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export type LiveState = "ON_RIDE" | "AVAILABLE" | "BUSY" | "OFFLINE";

export function liveState(driver: LiveDriver): LiveState {
  if (!driver.isOnline) return "OFFLINE";
  if (driver.ride) return "ON_RIDE";
  return driver.isAvailable ? "AVAILABLE" : "BUSY";
}

export const LIVE_STATE_STYLE: Record<LiveState, { label: string; color: string; tone: "green" | "blue" | "amber" | "slate" }> = {
  AVAILABLE: { label: "Available", color: "#059669", tone: "green" },
  ON_RIDE: { label: "On a ride", color: "#2563EB", tone: "blue" },
  BUSY: { label: "Busy", color: "#D97706", tone: "amber" },
  OFFLINE: { label: "Offline", color: "#64748B", tone: "slate" },
};

/** "12 s ago", "3 min ago" — for the last position time. */
export function ago(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export const mapsLink = (latitude: number, longitude: number) => `https://www.google.com/maps?q=${latitude},${longitude}`;
