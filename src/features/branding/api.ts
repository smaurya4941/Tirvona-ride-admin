/**
 * Branding: the logo and splash screen the mobile apps (and this panel)
 * show. `null` for a kind means "the default bundled in each app".
 */
import { useQuery } from "@tanstack/react-query";
import { env } from "@/config/env";
import { apiClient, useApi, useApiMutation } from "@/lib/api/hooks";
import type { ApiSuccess } from "@/lib/api/client";

export type BrandAssetKind = "logo" | "splash";

export interface BrandAsset {
  kind: BrandAssetKind;
  /** Relative to the API base (`/api/v1`); changes with every new image. */
  path: string;
  version: string;
  contentType: string;
  bytes: number;
  width: number;
  height: number;
  updatedAt: string;
}

export interface Branding {
  logo: BrandAsset | null;
  splash: BrandAsset | null;
}

export interface BrandAssetRule {
  label: string;
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  minAspect: number;
  maxAspect: number;
  hint: string;
}

export interface AdminBranding extends Branding {
  rules: Array<{ kind: BrandAssetKind; rule: BrandAssetRule }>;
}

export const brandAssetUrl = (asset: BrandAsset): string => `${env.apiBaseUrl}${asset.path}`;

const publicKey = ["branding"] as const;
const adminKey = ["admin", "branding"] as const;

/** Public — also used on the login page and in the sidebar. */
export const usePublicBranding = () =>
  useQuery({
    queryKey: publicKey,
    queryFn: async () => (await apiClient.get<ApiSuccess<Branding>>("/branding")).data.data,
    staleTime: 5 * 60_000,
    retry: 1,
  });

export const useAdminBranding = () => useApi<AdminBranding>(adminKey, "/admin/branding");

export const useUploadBrandAsset = () =>
  useApiMutation(
    ({ kind, file }: { kind: BrandAssetKind; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return apiClient.put<ApiSuccess<BrandAsset>>(`/admin/branding/${kind}`, form, { timeout: 60_000 });
    },
    [adminKey, publicKey],
  );

export const useResetBrandAsset = () =>
  useApiMutation(
    (kind: BrandAssetKind) => apiClient.delete<ApiSuccess<Branding>>(`/admin/branding/${kind}`),
    [adminKey, publicKey],
  );

/**
 * Mirrors the server's checks so the admin gets instant feedback; the
 * server re-checks the actual bytes and stays the authority.
 */
export async function checkImage(
  file: File,
  rule: BrandAssetRule,
): Promise<{ width: number; height: number; problem: string | null }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return { width: 0, height: 0, problem: `${rule.label} must be a PNG, JPEG or WEBP image` };
  const { width, height } = await imageSize(file).catch(() => ({ width: 0, height: 0 }));
  if (!width || !height) return { width, height, problem: "This file could not be read as an image" };
  if (file.size > rule.maxBytes)
    return { width, height, problem: `${rule.label} must be at most ${Math.round(rule.maxBytes / 1024 / 1024)} MB` };
  if (width < rule.minWidth || height < rule.minHeight)
    return { width, height, problem: `${rule.label} must be at least ${rule.minWidth} × ${rule.minHeight} px (this one is ${width} × ${height})` };
  const aspect = height / width;
  if (aspect < rule.minAspect || aspect > rule.maxAspect)
    return {
      width,
      height,
      problem: rule.minAspect > 1 ? "Use a portrait phone-shaped image (about 9 : 19.5)" : "Use a landscape or square logo",
    };
  return { width, height, problem: null };
}

async function imageSize(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
