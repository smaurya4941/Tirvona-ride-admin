import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { session } from "@/lib/auth/session";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

// Drop cached admin data the moment the session ends (sign-out or a failed
// token refresh), so nothing leaks into the next sign-in.
session.subscribe(() => {
  if (!session.get()) queryClient.clear();
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
