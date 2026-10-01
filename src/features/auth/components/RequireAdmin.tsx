import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/lib/auth/session";

/** Gate for every authenticated admin route; bounces to /login otherwise. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const current = useSession();
  const location = useLocation();
  if (current?.user.role !== "ADMIN") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}
