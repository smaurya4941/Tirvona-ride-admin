import { useState } from "react";
import defaultLogo from "@/assets/logo.png";
import { brandAssetUrl, usePublicBranding } from "../api";

/** The admin-set logo when there is one, otherwise the bundled default. */
export function BrandLogo({ className = "" }: { className?: string }) {
  const { data } = usePublicBranding();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const customUrl = data?.logo ? brandAssetUrl(data.logo) : null;
  const src = customUrl && customUrl !== failedUrl ? customUrl : defaultLogo;
  return (
    <img
      src={src}
      alt="Tirvona Ride"
      className={`object-contain ${className}`}
      onError={() => customUrl && setFailedUrl(customUrl)}
    />
  );
}

export { defaultLogo };
