const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function formatMoney(value?: number | null): string {
  return value === undefined || value === null ? "—" : rupees.format(value);
}

export function formatDateTime(value?: string | null): string {
  return value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
}

export function formatKm(meters?: number | null): string {
  return meters === undefined || meters === null ? "—" : `${(meters / 1000).toFixed(meters < 10_000 ? 2 : 1)} km`;
}

export function formatMinutes(seconds?: number | null): string {
  return seconds === undefined || seconds === null ? "—" : `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
