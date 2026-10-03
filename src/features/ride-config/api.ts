/**
 * Ride limits: per-ride-type trip distance (minimum in metres, maximum in km)
 * and the global matching / nearby-drivers radii (km). Types mirror the
 * NestJS responses; the server validates every value and stays the authority.
 */
import { apiClient, useApi, useApiMutation } from "@/lib/api/hooks";
import type { ApiSuccess } from "@/lib/api/client";
import type { RideTypeRow } from "@/features/platform/api";

export interface DistanceBounds {
  minDistanceMeters: { min: number; max: number };
  maxDistanceKm: { min: number; max: number };
}

export interface RideDistanceConfig {
  id: string;
  rideType: string;
  minDistanceMeters: number;
  maxDistanceKm: number;
  version: number;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RideDistanceRow {
  rideType: RideTypeRow["rideType"];
  config: RideDistanceConfig | null;
  /** False when a stored row holds values the server refuses to use. */
  usable: boolean;
}

export interface RideDistanceList {
  limits: DistanceBounds;
  items: RideDistanceRow[];
}

export interface RadiusBounds {
  matchingRadiusKm: { min: number; max: number };
  nearbyDriversRadiusKm: { min: number; max: number };
}

export interface PlatformSettings {
  matchingRadiusKm: number;
  nearbyDriversRadiusKm: number;
  version: number;
  updatedBy?: string;
  updatedAt: string;
}

export interface PlatformSettingsResponse {
  limits: RadiusBounds;
  settings: PlatformSettings | null;
}

const distanceKey = ["admin", "ride-distance-config"] as const;
const settingsKey = ["admin", "platform-settings"] as const;
// Ride types show their limits too, so edits refresh that list as well.
const refreshes = [distanceKey, settingsKey, ["admin", "ride-types"]];

export const useRideDistanceConfigs = () => useApi<RideDistanceList>(distanceKey, "/admin/ride-distance-config");

export const useUpdateRideDistance = () =>
  useApiMutation(
    ({ rideType, ...changes }: { rideType: string; minDistanceMeters?: number; maxDistanceKm?: number }) =>
      apiClient.patch<ApiSuccess<RideDistanceRow>>(`/admin/ride-distance-config/${rideType}`, changes),
    refreshes,
  );

export const usePlatformSettings = () => useApi<PlatformSettingsResponse>(settingsKey, "/admin/platform-settings");

export const useUpdatePlatformSettings = () =>
  useApiMutation(
    (changes: { matchingRadiusKm?: number; nearbyDriversRadiusKm?: number }) =>
      apiClient.patch<ApiSuccess<PlatformSettingsResponse>>("/admin/platform-settings", changes),
    refreshes,
  );

/** "200 m" / "80 km", always with the unit so metres and kilometres are never confused. */
export const formatMeters = (meters: number): string => `${meters.toLocaleString("en-IN")} m`;
export const formatKilometers = (km: number): string => `${km.toLocaleString("en-IN", { maximumFractionDigits: 3 })} km`;

/** A positive number with at most `decimals` decimals, within [min, max]; otherwise the reason. */
export function parseBounded(
  raw: string,
  label: string,
  bounds: { min: number; max: number },
  unit: string,
  decimals: number,
): { value: number } | { error: string } {
  const text = raw.trim();
  if (text === "") return { error: `${label} is required` };
  const pattern = decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || !pattern.test(text))
    return { error: decimals === 0 ? `${label} must be a whole number above zero` : `${label} must be a number above zero (up to ${decimals} decimals)` };
  if (value < bounds.min || value > bounds.max) return { error: `${label} must be between ${bounds.min} and ${bounds.max} ${unit}` };
  return { value };
}
