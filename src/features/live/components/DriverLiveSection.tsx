import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { PinMap } from "@/components/GoogleMap";
import { Pill } from "@/components/Ui";
import { LIVE_STATE_STYLE, ago, liveState, mapsLink, useLiveDriver } from "../api/live";

/**
 * "Where is this driver now?" on the driver detail page: a map that follows
 * the driver and refreshes every few seconds.
 */
export function DriverLiveSection({ driverId }: { driverId: string }) {
  const { data, error, isPending } = useLiveDriver(driverId);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (isPending)
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Locating driver…
      </p>
    );
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const style = LIVE_STATE_STYLE[liveState(data)];
  const location = data.location;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Pill tone={style.tone}>{style.label}</Pill>
        {location ? (
          <span className={location.fresh ? "text-slate-600" : "text-amber-600"}>
            {location.fresh ? "Live" : "Last known position"} · {ago(location.updatedAt, now)}
          </span>
        ) : (
          <span className="text-slate-500">This driver has not shared a position yet.</span>
        )}
        {data.ride && (
          <Link className="font-semibold text-bhagwa-600 hover:underline" to={`/rides/${data.ride.rideId}`}>
            Ride {data.ride.rideCode}
          </Link>
        )}
        <span className="ml-auto flex items-center gap-4">
          <Link className="font-semibold text-bhagwa-600 hover:underline" to={`/live-map?driver=${driverId}`}>
            Open on live map
          </Link>
          {location && (
            <a
              className="inline-flex items-center gap-1 font-semibold text-bhagwa-600 hover:underline"
              href={mapsLink(location.latitude, location.longitude)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Maps <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </span>
      </div>
      {location && (
        <div className="h-80 overflow-hidden rounded-lg border border-slate-200">
          <PinMap
            fitKey={driverId}
            selectedId={driverId}
            pins={[
              {
                id: driverId,
                latitude: location.latitude,
                longitude: location.longitude,
                heading: location.heading,
                title: data.name,
                color: style.color,
                faded: !location.fresh,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
