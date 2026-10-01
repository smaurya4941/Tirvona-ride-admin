const apiOrigin = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export const env = {
  // Empty origin → same-origin `/api/v1`, served by the Vite proxy in dev.
  apiBaseUrl: `${apiOrigin}/api/v1`,
  isProduction: import.meta.env.PROD,
} as const;
