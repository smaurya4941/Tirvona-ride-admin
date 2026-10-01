import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/features/branding/components/BrandLogo";
import { useSession } from "@/lib/auth/session";
import { login } from "../api/auth";

// Bare 10-digit numbers are assumed Indian (+91), matching the mobile app.
function normalizePhone(input: string): string {
  const digits = input.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+")) return digits;
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

export function LoginPage() {
  const current = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
  if (current?.user.role === "ADMIN") return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(normalizePhone(phone), password);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <BrandLogo className="mx-auto mb-5 h-32 w-full" />
        <h1 className="text-xl font-bold text-midnight">Tirvona Rides Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to manage ride operations</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Mobile number</span>
            <input
              type="tel"
              autoComplete="username"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98XXXXXXXX"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bhagwa-500 focus:outline-none focus:ring-1 focus:ring-bhagwa-500"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !phone || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-bhagwa-500 py-2.5 text-sm font-semibold text-white hover:bg-bhagwa-600 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
