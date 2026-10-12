import { useEffect, useState } from "react";
import { Download, Headphones, Loader2, Mic, MicOff, Play, Square } from "lucide-react";
import { Field, Section, timeAgo } from "@/components/DetailUi";
import { formatDateTime } from "@/lib/format";
import { fetchSosRecording } from "../api/sos";
import type { SosAudio, SosAudioState } from "../api/sos";
import { useLiveSosAudio } from "../hooks/useLiveSosAudio";
import type { LiveAudioStatus } from "../hooks/useLiveSosAudio";

const badge = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

const STATE_BADGE: Record<SosAudioState, { label: string; style: string }> = {
  RECORDING: { label: "Recording now", style: "bg-red-600 text-white" },
  STOPPED: { label: "Recording ended", style: "bg-slate-200 text-slate-700" },
  INTERRUPTED: { label: "Audio stopped arriving", style: "bg-amber-100 text-amber-800" },
  UNAVAILABLE: { label: "Phone could not record", style: "bg-red-100 text-red-700" },
  NONE: { label: "No audio yet", style: "bg-slate-100 text-slate-600" },
};

const LIVE_TEXT: Record<LiveAudioStatus, string> = {
  idle: "",
  connecting: "Connecting…",
  listening: "Listening live",
  waiting: "The phone is not sending audio right now. Waiting…",
  error: "Connection problem. Trying again…",
};

const DEVICE_TEXT: Record<NonNullable<SosAudio["deviceState"]>, string> = {
  RECORDING: "recording",
  STOPPED: "stopped by the person",
  PERMISSION_DENIED: "microphone permission is off",
  FAILED: "could not open the microphone",
};

function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const KIND_TEXT = { LIVE: "listened live", PLAYBACK: "played the recording", DOWNLOAD: "downloaded the recording" } as const;

/** Live listening, playback and download of the SOS microphone recording, and who has listened. */
export function SosAudioPanel({ sosId, sosCode, audio }: { sosId: string; sosCode: string; audio: SosAudio }) {
  const live = useLiveSosAudio(sosId);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<"play" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The player's blob is released when it is replaced or the page closes.
  useEffect(() => () => (recordingUrl ? URL.revokeObjectURL(recordingUrl) : undefined), [recordingUrl]);

  const hasAudio = audio.chunks > 0;
  const recording = audio.state === "RECORDING";
  const state = STATE_BADGE[audio.state];

  async function load(kind: "play" | "download") {
    setLoading(kind);
    setError(null);
    try {
      const blob = await fetchSosRecording(sosId, kind === "download");
      const url = URL.createObjectURL(blob);
      if (kind === "play") {
        live.stop();
        setRecordingUrl(url);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${sosCode}.wav`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the recording");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Section
      title="Sound from the phone"
      action={
        <span className={`${badge} ${state.style}`}>
          {recording ? <Mic className="h-3 w-3 animate-pulse" aria-hidden /> : audio.state === "UNAVAILABLE" ? <MicOff className="h-3 w-3" aria-hidden /> : null}
          {state.label}
        </span>
      }
    >
      {!audio.enabled && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Audio recording is switched off on the server (SOS_AUDIO_ENABLED).</p>}

      {audio.state === "UNAVAILABLE" && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          The phone could not record ({audio.deviceState ? DEVICE_TEXT[audio.deviceState] : "unknown reason"}). The alert and location were still sent — call them.
        </p>
      )}
      {audio.state === "INTERRUPTED" && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No audio for a while (phone offline, app closed or battery). {audio.lastChunkAt ? `Last audio ${timeAgo(audio.lastChunkAt)}.` : ""} Call them.
        </p>
      )}
      {audio.missingChunks > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {audio.missingChunks} chunk{audio.missingChunks === 1 ? "" : "s"} (≈{audio.missingChunks * 5} s) never arrived, so the recording has gaps.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {recording &&
          (live.listening ? (
            <button type="button" onClick={live.stop} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
              <Square className="h-4 w-4" aria-hidden /> Stop listening
            </button>
          ) : (
            <button type="button" onClick={live.start} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              <Headphones className="h-4 w-4" aria-hidden /> Listen live
            </button>
          ))}
        {hasAudio && (
          <>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void load("play")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading === "play" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {recordingUrl ? "Reload recording" : "Play recording"}
            </button>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void load("download")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading === "download" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              Download (.wav)
            </button>
          </>
        )}
      </div>
      {live.listening && <p className="mt-2 text-sm font-medium text-red-700">{LIVE_TEXT[live.status]}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {recordingUrl && <audio className="mt-3 w-full" controls autoPlay src={recordingUrl} />}
      {!hasAudio && audio.state !== "UNAVAILABLE" && (
        <p className="mt-1 text-sm text-slate-500">
          {audio.state === "NONE" ? "No audio has arrived from the phone yet. It starts when the person presses SOS and the microphone is on." : ""}
        </p>
      )}

      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Saved on the server" value={hasAudio ? `${duration(audio.seconds)} · ${megabytes(audio.bytes)}` : "—"} />
        <Field label="Last audio" value={audio.lastChunkAt ? `${formatDateTime(audio.lastChunkAt)} (${timeAgo(audio.lastChunkAt)})` : undefined} />
        <Field label="Phone microphone" value={audio.deviceState ? DEVICE_TEXT[audio.deviceState] : undefined} />
        <Field label="Notice accepted" value={audio.consentVersion} mono />
        <Field label="Kept until" value={audio.retentionUntil ? formatDateTime(audio.retentionUntil) : undefined} />
        <Field label="Format" value={hasAudio ? `${audio.sampleRate / 1000} kHz mono WAV` : undefined} />
      </dl>

      {audio.access.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-900">Who listened</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {[...audio.access].reverse().map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className="font-medium text-slate-800">{entry.actor === "ADMIN" ? (entry.admin ?? "An admin") : "An emergency contact (tracking link)"}</span>{" "}
                {KIND_TEXT[entry.kind]} · {formatDateTime(entry.at)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        This is a private recording of someone in an emergency. Listen only to handle this incident; every listen and download is logged and audited.
      </p>
    </Section>
  );
}
