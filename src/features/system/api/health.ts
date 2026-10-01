import { useQuery } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";

export type DependencyStatus = "up" | "down" | "disabled";

export interface HealthReport {
  service: string;
  status: "ready" | "degraded";
  environment: string;
  uptimeSeconds: number;
  checks: { database: DependencyStatus; redis: DependencyStatus };
  timestamp: string;
}

// A degraded API answers 503 with the full report; surface it as data.
async function fetchHealth(): Promise<HealthReport> {
  try {
    const response = await apiClient.get<ApiSuccess<HealthReport>>("/health");
    return response.data.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 503 && error.data) return error.data as HealthReport;
    throw error;
  }
}

export function useHealth() {
  return useQuery({
    queryKey: ["system", "health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: false,
  });
}
