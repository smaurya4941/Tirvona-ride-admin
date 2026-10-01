import axios, { AxiosError } from "axios";
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";
import { session } from "@/lib/auth/session";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code?: string;
  errors?: string[];
  data?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly data?: unknown;

  constructor(message: string, init: Partial<Pick<ApiError, "status" | "code" | "requestId" | "data">> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.data = init.data;
  }
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});

// Separate instance with no interceptors: the refresh call must never
// trigger the 401 handler below, or a dead refresh token would loop.
const refreshClient = axios.create({ baseURL: env.apiBaseUrl, timeout: 20_000 });

const AUTH_PATHS = ["/auth/login", "/admin/auth/login", "/auth/refresh", "/auth/logout"];

apiClient.interceptors.request.use((config) => {
  const accessToken = session.get()?.accessToken;
  if (accessToken) config.headers.set("Authorization", `Bearer ${accessToken}`);
  return config;
});

// Concurrent 401s share one refresh round-trip instead of each rotating the
// refresh token (which would revoke the others' tokens server-side).
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = session.get()?.refreshToken;
  if (!refreshToken) return null;
  try {
    const response = await refreshClient.post<ApiSuccess<{ accessToken: string; refreshToken: string }>>(
      "/auth/refresh",
      { refreshToken },
    );
    const { accessToken, refreshToken: nextRefreshToken } = response.data.data;
    session.updateTokens(accessToken, nextRefreshToken);
    return accessToken;
  } catch {
    return null;
  }
}

function toApiError(error: AxiosError): ApiError {
  const body = error.response?.data as Partial<ApiErrorBody> | undefined;
  const message =
    body?.message ??
    (error.response ? `Request failed (${error.response.status})` : "Cannot reach the Tirvona Rides API");
  return new ApiError(message, {
    status: error.response?.status,
    code: body?.code,
    requestId: body?.requestId ?? (error.response?.headers["x-request-id"] as string | undefined),
    data: body?.data,
  });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError)) return Promise.reject(error);

    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthPath = AUTH_PATHS.some((path) => original?.url?.startsWith(path));
    if (error.response?.status === 401 && original && !original._retried && !isAuthPath) {
      original._retried = true;
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const accessToken = await refreshInFlight;
      if (accessToken) {
        original.headers.set("Authorization", `Bearer ${accessToken}`);
        return apiClient.request(original as AxiosRequestConfig);
      }
      session.clear();
    }

    return Promise.reject(toApiError(error));
  },
);
