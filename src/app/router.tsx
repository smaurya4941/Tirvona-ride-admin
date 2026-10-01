import { createBrowserRouter } from "react-router-dom";
import { RequireAdmin } from "@/features/auth/components/RequireAdmin";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { ComplaintDetailPage } from "@/features/complaints/pages/ComplaintDetailPage";
import { BrandingPage } from "@/features/branding/pages/BrandingPage";
import { PopularPlacesPage } from "@/features/places/pages/PopularPlacesPage";
import { ComplaintsPage } from "@/features/complaints/pages/ComplaintsPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { DriverChangeDetailPage } from "@/features/driver-changes/pages/DriverChangeDetailPage";
import { DriverChangesPage } from "@/features/driver-changes/pages/DriverChangesPage";
import { DriverDetailPage } from "@/features/drivers/pages/DriverDetailPage";
import { DriversPage } from "@/features/drivers/pages/DriversPage";
import { DriverEarningsPage } from "@/features/earnings/pages/DriverEarningsPage";
import { EarningsPage } from "@/features/earnings/pages/EarningsPage";
import { NotificationsPage } from "@/features/notifications/pages/NotificationsPage";
import { CommissionPage } from "@/features/payments/pages/CommissionPage";
import { PaymentDetailPage } from "@/features/payments/pages/PaymentDetailPage";
import { PaymentsPage } from "@/features/payments/pages/PaymentsPage";
import { ReconciliationPage } from "@/features/payments/pages/ReconciliationPage";
import { RefundsPage } from "@/features/payments/pages/RefundsPage";
import { PricingPage } from "@/features/pricing/pages/PricingPage";
import { RideDetailPage } from "@/features/rides/pages/RideDetailPage";
import { RidesPage } from "@/features/rides/pages/RidesPage";
import { SafetyPage } from "@/features/safety/pages/SafetyPage";
import { SosDetailPage } from "@/features/safety/pages/SosDetailPage";
import { AuditLogPage } from "@/features/platform/pages/AuditLogPage";
import { BroadcastsPage } from "@/features/platform/pages/BroadcastsPage";
import { CancellationsPage } from "@/features/platform/pages/CancellationsPage";
import { CustomerDetailPage, CustomersPage } from "@/features/platform/pages/CustomersPage";
import { PromoDetailPage, PromotionsPage } from "@/features/platform/pages/PromotionsPage";
import { ReportsPage } from "@/features/platform/pages/ReportsPage";
import { RideTypesPage } from "@/features/platform/pages/RideTypesPage";
import { VehiclesPage } from "@/features/platform/pages/VehiclesPage";
import { ZoneEditorPage, ZonesPage } from "@/features/platform/pages/ZonesPage";
import { AdminLayout } from "@/layouts/AdminLayout";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "drivers", element: <DriversPage /> },
      { path: "drivers/:id", element: <DriverDetailPage /> },
      { path: "driver-updates", element: <DriverChangesPage /> },
      { path: "driver-updates/:id", element: <DriverChangeDetailPage /> },
      { path: "rides", element: <RidesPage /> },
      { path: "rides/:id", element: <RideDetailPage /> },
      { path: "pricing", element: <PricingPage /> },
      { path: "payments", element: <PaymentsPage /> },
      { path: "payments/refunds", element: <RefundsPage /> },
      { path: "payments/reconciliation", element: <ReconciliationPage /> },
      { path: "payments/:id", element: <PaymentDetailPage /> },
      { path: "commission", element: <CommissionPage /> },
      { path: "earnings", element: <EarningsPage /> },
      { path: "earnings/:driverId", element: <DriverEarningsPage /> },
      { path: "safety", element: <SafetyPage /> },
      { path: "safety/:id", element: <SosDetailPage /> },
      { path: "complaints", element: <ComplaintsPage /> },
      { path: "complaints/:id", element: <ComplaintDetailPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      // Phase 7
      { path: "customers", element: <CustomersPage /> },
      { path: "customers/:id", element: <CustomerDetailPage /> },
      { path: "vehicles", element: <VehiclesPage /> },
      { path: "ride-types", element: <RideTypesPage /> },
      { path: "zones", element: <ZonesPage /> },
      { path: "zones/new", element: <ZoneEditorPage /> },
      { path: "zones/:id", element: <ZoneEditorPage /> },
      { path: "branding", element: <BrandingPage /> },
      { path: "popular-places", element: <PopularPlacesPage /> },
      { path: "promotions", element: <PromotionsPage /> },
      { path: "promotions/:id", element: <PromoDetailPage /> },
      { path: "cancellations", element: <CancellationsPage /> },
      { path: "broadcasts", element: <BroadcastsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "audit-log", element: <AuditLogPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
