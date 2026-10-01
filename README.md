# Tirvona Rides — Admin Panel

Operations panel for Tirvona Rides: drivers and KYC, rides, pricing, payments, safety. React 19 + Vite + Tailwind + React Query, same stack as the main Tirvona `frontend`.

```powershell
npm install
npm run dev        # http://localhost:5180 — /api is proxied to http://localhost:5100
npm run lint
npm run build
```

Configuration: see `.env.example` (`VITE_API_PROXY_TARGET` for dev, `VITE_API_URL` for production builds).

## Structure

```
src/
├── main.tsx
├── app/            # App (providers), router, navigation config
├── config/         # env
├── layouts/        # AdminLayout (sidebar shell)
├── lib/api/        # axios client + ApiError (backend envelope)
├── features/<feature>/
│   ├── api/        # React Query hooks
│   ├── components/
│   └── pages/
├── pages/          # NotFound
└── styles/
```

Sidebar items for later phases are shown disabled with their phase number (`src/app/navigation.ts`); raise `CURRENT_PHASE` as modules land.
