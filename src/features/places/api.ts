/**
 * Popular destinations shown on the rider's Home and "Where to?" screens.
 * Riders see the active places near them, nearest first.
 */
import { env } from "@/config/env";
import { apiClient, useApi, useApiMutation } from "@/lib/api/hooks";
import type { ApiSuccess } from "@/lib/api/client";

export interface PopularPlace {
  id: string;
  name: string;
  secondaryText: string;
  city: string;
  latitude: number;
  longitude: number;
  active: boolean;
  sortOrder: number;
  /** Relative to the API base (`/api/v1`); null when no photo is set. */
  imagePath: string | null;
  image: { width: number; height: number; bytes: number } | null;
  updatedAt: string;
}

export interface PopularImageRule {
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  minAspect: number;
  maxAspect: number;
  hint: string;
}

export interface PopularPlaceInput {
  name: string;
  secondaryText: string;
  city: string;
  latitude: number;
  longitude: number;
  active?: boolean;
  sortOrder?: number;
}

export const popularPlaceImageUrl = (place: PopularPlace): string | null =>
  place.imagePath ? `${env.apiBaseUrl}${place.imagePath}` : null;

const key = ["admin", "popular-places"] as const;

export const usePopularPlaces = () =>
  useApi<{ places: PopularPlace[]; imageRule: PopularImageRule }>(key, "/admin/popular-places");

export const useCreatePopularPlace = () =>
  useApiMutation((input: PopularPlaceInput) => apiClient.post<ApiSuccess<PopularPlace>>("/admin/popular-places", input), [key]);

export const useUpdatePopularPlace = () =>
  useApiMutation(
    ({ id, ...changes }: { id: string } & Partial<PopularPlaceInput>) =>
      apiClient.patch<ApiSuccess<PopularPlace>>(`/admin/popular-places/${id}`, changes),
    [key],
  );

export const useDeletePopularPlace = () =>
  useApiMutation((id: string) => apiClient.delete<ApiSuccess<{ deleted: true }>>(`/admin/popular-places/${id}`), [key]);

export const useUploadPopularPlaceImage = () =>
  useApiMutation(
    ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return apiClient.put<ApiSuccess<PopularPlace>>(`/admin/popular-places/${id}/image`, form, { timeout: 60_000 });
    },
    [key],
  );

export const useRemovePopularPlaceImage = () =>
  useApiMutation((id: string) => apiClient.delete<ApiSuccess<PopularPlace>>(`/admin/popular-places/${id}/image`), [key]);

/** Mirrors the server's photo checks for instant feedback; the server re-checks the bytes. */
export async function checkPlacePhoto(file: File, rule: PopularImageRule): Promise<string | null> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "Photo must be a PNG, JPEG or WEBP image";
  if (file.size > rule.maxBytes) return "Photo must be at most 1 MB";
  let width = 0;
  let height = 0;
  try {
    const bitmap = await createImageBitmap(file);
    ({ width, height } = bitmap);
    bitmap.close();
  } catch {
    return "This file could not be read as an image";
  }
  if (width < rule.minWidth || height < rule.minHeight)
    return `Photo must be at least ${rule.minWidth} × ${rule.minHeight} px (this one is ${width} × ${height})`;
  const aspect = height / width;
  if (aspect < rule.minAspect || aspect > rule.maxAspect) return "Use a landscape photo (about 16 : 10)";
  return null;
}
