import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ivory">
      <p className="text-5xl font-bold text-bhagwa-500">404</p>
      <p className="text-slate-600">This page does not exist.</p>
      <Link to="/" className="text-sm font-semibold text-bhagwa-600 underline">
        Back to dashboard
      </Link>
    </div>
  );
}
