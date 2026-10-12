import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiSuccess } from "@/lib/api/client";
import type { Page } from "@/features/rides/api/rides";

export const SOS_STATUSES = ["TRIGGERED", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const;
export type SosStatus = (typeof SOS_STATUSES)[number];
export const OPEN_SOS_STATUSES: readonly SosStatus[] = ["TRIGGERED", "ACKNOWLEDGED", "IN_PROGRESS"];

interface Person {
  id: string;
  name: string;
  phone: string;
}

export interface SosLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  address?: string;
  source: "DEVICE" | "DRIVER_LAST_KNOWN" | "RIDE_PICKUP";
  capturedAt: string;
}

export interface SosListItem {
  id: string;
  sosCode: string;
  status: SosStatus;
  rideId: string;
  rideCode: string;
  rideStatus: string;
  raisedByRole: "CUSTOMER" | "DRIVER";
  raisedBy: Person | null;
  customer: Person | null;
  driver: (Person & { driverCode: string }) | null;
  vehiclePlate?: string;
  vehicleType?: string;
  location: SosLocation;
  message?: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  inProgressAt?: string;
  resolvedAt?: string;
  cancelledAt?: string;
}

export type SosAudioState = "NONE" | "RECORDING" | "STOPPED" | "INTERRUPTED" | "UNAVAILABLE";

/** The microphone recording of an incident, as the server has stored it. */
export interface SosAudio {
  enabled: boolean;
  state: SosAudioState;
  /** What the phone last said about its microphone. */
  deviceState?: "RECORDING" | "STOPPED" | "PERMISSION_DENIED" | "FAILED";
  chunks: number;
  seconds: number;
  bytes: number;
  nextSeq: number;
  sampleRate: number;
  /** Chunks that never arrived: a gap in the recording. */
  missingChunks: number;
  firstChunkAt?: string;
  lastChunkAt?: string;
  stoppedAt?: string;
  consentVersion?: string;
  retentionUntil?: string;
  /** Who listened, newest last. */
  access: Array<{ actor: "ADMIN" | "CONTACT"; kind: "LIVE" | "PLAYBACK" | "DOWNLOAD"; at: string; admin?: string }>;
}

export interface SosAudioChunks {
  chunks: Array<{ seq: number; durationMs: number }>;
  latestSeq: number;
  state: SosAudioState;
  seconds: number;
}

export interface SosDetail extends SosListItem {
  audio: SosAudio;
  locationUpdates: SosLocation[];
  emergencyContacts: Array<{ name: string; phone: string; relationship?: string; isPrimary: boolean }>;
  contactsNotification: "NOT_SENT" | "SENT" | "FAILED";
  /** Every WhatsApp message sent to the contacts (location pin + live link), oldest first. */
  contactAlerts: Array<{
    name: string;
    phone: string;
    kind: "ALERT" | "UPDATE";
    status: "SENT" | "FAILED";
    failure?: string;
    attempts: number;
    at: string;
  }>;
  /** True while the contacts' live-tracking link works. */
  trackingActive: boolean;
  resolutionNote?: string;
  handledBy: { id: string; name: string } | null;
  timeline: Array<{ status: SosStatus; at: string; byRole: string; by: string | null; note?: string }>;
  ride: {
    id: string;
    rideCode: string;
    status: string;
    rideType: string;
    pickup: { address: string; latitude: number; longitude: number };
    destination: { address: string; latitude: number; longitude: number };
    vehicle?: { vehicleType: string; registrationNumber: string; make?: string; model?: string; color?: string };
    requestedAt: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
  } | null;
  driverLocation?: { latitude: number; longitude: number; updatedAt: string };
}

export interface SosSummary {
  open: number;
  unacknowledged: number;
  acknowledged: number;
  inProgress: number;
  resolvedToday: number;
  oldestUnacknowledgedAt?: string;
}

export interface SosFilters {
  page: number;
  status?: SosStatus;
  open?: boolean;
}

const keys = {
  all: ["admin", "sos"] as const,
  list: (filters: SosFilters) => [...keys.all, "list", filters] as const,
  summary: () => [...keys.all, "summary"] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
};

/** SOS is time-critical: every SOS view refreshes every 10 seconds. */
const SOS_REFRESH_MS = 10_000;

export function useSosList(filters: SosFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () =>
      (
        await apiClient.get<ApiSuccess<Page<SosListItem>>>("/admin/sos", {
          params: { page: filters.page, limit: 25, status: filters.status, open: filters.open || undefined },
        })
      ).data.data,
    placeholderData: keepPreviousData,
    refetchInterval: SOS_REFRESH_MS,
  });
}

/** Polled app-wide by the alert banner — keeps running in background tabs. */
export function useSosSummary() {
  return useQuery({
    queryKey: keys.summary(),
    queryFn: async () => (await apiClient.get<ApiSuccess<SosSummary>>("/admin/sos/summary")).data.data,
    refetchInterval: SOS_REFRESH_MS,
    refetchIntervalInBackground: true,
  });
}

export function useSos(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => (await apiClient.get<ApiSuccess<SosDetail>>(`/admin/sos/${id}`)).data.data,
    refetchInterval: (query) =>
      query.state.data && OPEN_SOS_STATUSES.includes(query.state.data.status) ? SOS_REFRESH_MS : false,
  });
}

export function useUpdateSos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: SosStatus; note?: string }) =>
      (await apiClient.patch<ApiSuccess<SosDetail>>(`/admin/sos/${id}`, { status, note: note || undefined })).data.data,
    onSuccess: (detail) => {
      queryClient.setQueryData(keys.detail(detail.id), detail);
      return queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });
}

/** Sends the WhatsApp alert again to the contacts it did not reach. */
export function useNotifyContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post<ApiSuccess<SosDetail>>(`/admin/sos/${id}/notify-contacts`)).data.data,
    onSuccess: (detail) => {
      queryClient.setQueryData(keys.detail(detail.id), detail);
      return queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });
}

/** The recording so far as one WAV file. The API needs the admin's token, so it is fetched, not linked. */
export async function fetchSosRecording(id: string, download = false): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/admin/sos/${id}/audio/recording`, {
    params: download ? { download: 1 } : undefined,
    responseType: "blob",
    timeout: 120_000,
  });
  return response.data;
}

export async function fetchSosAudioChunks(id: string, query: { after?: number; tail?: number }): Promise<SosAudioChunks> {
  return (await apiClient.get<ApiSuccess<SosAudioChunks>>(`/admin/sos/${id}/audio/chunks`, { params: query })).data.data;
}

export async function fetchSosAudioChunk(id: string, seq: number): Promise<ArrayBuffer> {
  return (await apiClient.get<ArrayBuffer>(`/admin/sos/${id}/audio/chunks/${seq}`, { responseType: "arraybuffer" })).data;
}

export const mapsLink =(latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
