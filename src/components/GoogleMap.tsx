import { useEffect, useRef, useState } from "react";
import { env } from "@/config/env";

type LoadState = { status: "disabled" | "loading" | "ready" | "error" };

let loader: Promise<void> | undefined;

/** Loads the Maps JavaScript API once per page load. */
function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const callback = "__tirvonaMapsReady";
    (window as unknown as Record<string, unknown>)[callback] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(env.googleMapsApiKey)}&callback=${callback}&loading=async&v=weekly`;
    script.async = true;
    script.onerror = () => {
      loader = undefined;
      reject(new Error("Could not load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export function useGoogleMaps(): LoadState["status"] {
  const [status, setStatus] = useState<LoadState["status"]>(
    !env.googleMapsApiKey ? "disabled" : window.google?.maps?.Map ? "ready" : "loading",
  );
  useEffect(() => {
    if (!env.googleMapsApiKey || status === "ready") return;
    let active = true;
    loadGoogleMaps().then(
      () => active && setStatus("ready"),
      () => active && setStatus("error"),
    );
    return () => {
      active = false;
    };
  }, [status]);
  return status;
}

export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  /** Marker fill colour. */
  color: string;
  /** Rotation in degrees (the vehicle's heading), when known. */
  heading?: number;
  faded?: boolean;
}

const BRAJ = { lat: 27.5, lng: 77.67 };

function iconFor(pin: MapPin, selected: boolean): google.maps.Symbol {
  const moving = pin.heading !== undefined;
  return {
    path: moving ? google.maps.SymbolPath.FORWARD_CLOSED_ARROW : google.maps.SymbolPath.CIRCLE,
    scale: moving ? (selected ? 7 : 5.5) : selected ? 11 : 8,
    rotation: pin.heading ?? 0,
    fillColor: pin.color,
    fillOpacity: pin.faded ? 0.45 : 1,
    strokeColor: selected ? "#0B192C" : "#ffffff",
    strokeWeight: selected ? 3 : 2,
  };
}

/**
 * A Google map with one marker per pin. Markers are reused between renders
 * (moved, not re-created) so a 5-second refresh does not flicker, and the
 * viewport only auto-fits when the set of pins first appears or `fitKey`
 * changes, so an admin who panned away is not yanked back.
 */
export function PinMap({
  pins,
  selectedId,
  onSelect,
  fitKey,
  className = "h-full w-full",
}: {
  pins: MapPin[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  fitKey?: string;
  className?: string;
}) {
  const status = useGoogleMaps();
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, google.maps.Marker>());
  const fitted = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (status !== "ready" || !element.current || map.current) return;
    map.current = new google.maps.Map(element.current, {
      center: BRAJ,
      zoom: 11,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      clickableIcons: false,
    });
  }, [status]);

  useEffect(() => {
    const instance = map.current;
    if (status !== "ready" || !instance) return;
    const live = markers.current;
    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.id);
      const position = { lat: pin.latitude, lng: pin.longitude };
      const selected = pin.id === selectedId;
      let marker = live.get(pin.id);
      if (!marker) {
        marker = new google.maps.Marker({ map: instance, position });
        marker.addListener("click", () => onSelectRef.current?.(pin.id));
        live.set(pin.id, marker);
      }
      marker.setPosition(position);
      marker.setTitle(pin.title);
      marker.setIcon(iconFor(pin, selected));
      marker.setZIndex(selected ? 1000 : 1);
    }
    for (const [id, marker] of live) {
      if (seen.has(id)) continue;
      marker.setMap(null);
      live.delete(id);
    }

    const key = fitKey ?? "default";
    if (pins.length > 0 && fitted.current !== key) {
      fitted.current = key;
      if (pins.length === 1) {
        instance.setCenter({ lat: pins[0].latitude, lng: pins[0].longitude });
        instance.setZoom(15);
      } else {
        const bounds = new google.maps.LatLngBounds();
        for (const pin of pins) bounds.extend({ lat: pin.latitude, lng: pin.longitude });
        instance.fitBounds(bounds, 60);
      }
    }
  }, [pins, selectedId, status, fitKey]);

  // Follow the selected driver when they move off screen.
  useEffect(() => {
    const instance = map.current;
    const pin = pins.find((candidate) => candidate.id === selectedId);
    if (status !== "ready" || !instance || !pin) return;
    const position = new google.maps.LatLng(pin.latitude, pin.longitude);
    if (!instance.getBounds()?.contains(position)) instance.panTo(position);
  }, [pins, selectedId, status]);

  useEffect(
    () => () => {
      for (const marker of markers.current.values()) marker.setMap(null);
      markers.current.clear();
      map.current = null;
    },
    [],
  );

  if (status === "disabled")
    return (
      <div className={`${className} flex items-center justify-center bg-slate-50 p-6 text-center text-sm text-slate-500`}>
        The map needs a Google Maps key. Set <code className="mx-1 rounded bg-slate-200 px-1">VITE_GOOGLE_MAPS_API_KEY</code> in the
        admin panel's environment and rebuild.
      </div>
    );
  if (status === "error")
    return (
      <div className={`${className} flex items-center justify-center bg-slate-50 p-6 text-center text-sm text-red-600`}>
        Google Maps could not be loaded. Check the key, its allowed origins and the network.
      </div>
    );
  return <div ref={element} className={className} aria-label="Map" />;
}
