const apiOrigin = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export const env = {
  // Empty origin → same-origin `/api/v1`, served by the Vite proxy in dev.
  apiBaseUrl: `${apiOrigin}/api/v1`,
  // Browser key (Maps JavaScript API, restricted to the admin origin). Empty hides the maps.
  googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim(),
  isProduction: import.meta.env.PROD,
} as const;
