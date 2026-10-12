import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSosAudioChunk, fetchSosAudioChunks } from "../api/sos";

export type LiveAudioStatus = "idle" | "connecting" | "listening" | "waiting" | "error";

type AudioContextConstructor = typeof AudioContext;

/** How long to wait between looks for new chunks while listening. */
const POLL_MS = 2000;

/**
 * Listens to an SOS recording as it arrives. The phone uploads a chunk every
 * few seconds; this polls for new ones, decodes each as a small WAV and
 * schedules it right after the previous one, starting two chunks behind the
 * live edge so playback does not stutter. Everything is fetched with the
 * admin's token, so nothing here is reachable without signing in.
 */
export function useLiveSosAudio(sosId: string) {
  const [status, setStatus] = useState<LiveAudioStatus>("idle");
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    if (stopRef.current) return;
    const Ctor: AudioContextConstructor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Ctor) {
      setStatus("error");
      return;
    }
    // Created in the click handler so the browser lets it make sound.
    const context = new Ctor();
    void context.resume();
    let running = true;
    let after = -1;
    let nextTime = 0;
    setStatus("connecting");

    const play = async (seq: number) => {
      const wav = await fetchSosAudioChunk(sosId, seq);
      const decoded = await context.decodeAudioData(wav);
      const source = context.createBufferSource();
      source.buffer = decoded;
      source.connect(context.destination);
      const at = Math.max(nextTime, context.currentTime + 0.15);
      source.start(at);
      nextTime = at + decoded.duration;
    };

    const loop = async () => {
      while (running) {
        try {
          const list = await fetchSosAudioChunks(sosId, after < 0 ? { tail: 2 } : { after });
          for (const chunk of list.chunks) {
            if (!running) break;
            await play(chunk.seq);
            after = chunk.seq;
          }
          if (running) setStatus(list.state === "RECORDING" ? "listening" : "waiting");
        } catch {
          if (running) setStatus("error");
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    };
    void loop();

    stopRef.current = () => {
      running = false;
      void context.close().catch(() => undefined);
    };
  }, [sosId]);

  // Leaving the page ends the listening.
  useEffect(() => () => stopRef.current?.(), []);

  return { status, listening: status !== "idle", start, stop };
}
