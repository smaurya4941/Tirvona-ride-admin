import { apiClient, ApiError } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";
import { session } from "@/lib/auth/session";
import type { AdminUser } from "@/lib/auth/session";

interface AuthResponse {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
}

export async function login(phone: string, password: string): Promise<AdminUser> {
  // Admin-only endpoint (Phase 7): non-admin accounts get the generic
  // invalid-credentials error, and it carries the strictest rate limit.
  const response = await apiClient.post<ApiSuccess<AuthResponse>>("/admin/auth/login", {
    phone,
    password,
    deviceType: "admin-web",
    deviceName: navigator.userAgent.slice(0, 120),
  });
  const { user, accessToken, refreshToken } = response.data.data;

  // Defence in depth: the server already refuses non-admins here.
  if (user.role !== "ADMIN") {
    void apiClient.post("/auth/logout", { refreshToken }).catch(() => undefined);
    throw new ApiError("This account does not have admin access", { code: "ADMIN_UNAUTHORIZED", status: 403 });
  }

  session.set({ user, accessToken, refreshToken });
  return user;
}

export async function logout(): Promise<void> {
  const refreshToken = session.get()?.refreshToken;
  session.clear();
  if (refreshToken) await apiClient.post("/auth/logout", { refreshToken }).catch(() => undefined);
}
