import { createBrowserRouter } from "react-router-dom";
import { RequireAdmin } from "@/features/auth/components/RequireAdmin";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { ComplaintDetailPage } from "@/features/complaints/pages/ComplaintDetailPage";
import { BrandingPage } from "@/features/branding/pages/BrandingPage";
import { PopularPlacesPage } from "@/features/places/pages/PopularPlacesPage";
import { ComplaintsPage } from "@/features/complaints/pages/ComplaintsPage";
import { CircuitBookingDetailPage } from "@/features/circuits/pages/CircuitBookingDetailPage";
import { CircuitBookingsPage } from "@/features/circuits/pages/CircuitBookingsPage";
import { CircuitPackageEditorPage } from "@/features/circuits/pages/CircuitPackageEditorPage";
import { CircuitPackagesPage } from "@/features/circuits/pages/CircuitPackagesPage";
import { CircuitReportsPage } from "@/features/circuits/pages/CircuitReportsPage";
import { LiveCircuitsPage } from "@/features/circuits/pages/LiveCircuitsPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { DriverChangeDetailPage } from "@/features/driver-changes/pages/DriverChangeDetailPage";
import { DriverChangesPage } from "@/features/driver-changes/pages/DriverChangesPage";
import { DriverDetailPage } from "@/features/drivers/pages/DriverDetailPage";
import { DriversPage } from "@/features/drivers/pages/DriversPage";
import { LiveMapPage } from "@/features/live/pages/LiveMapPage";
import { DriverEarningsPage } from "@/features/earnings/pages/DriverEarningsPage";
import { EarningsPage } from "@/features/earnings/pages/EarningsPage";
import { NotificationsPage } from "@/features/notifications/pages/NotificationsPage";
import { CommissionPage } from "@/features/payments/pages/CommissionPage";
import { CommissionRideTypePage } from "@/features/payments/pages/CommissionRideTypePage";
import { PaymentDetailPage } from "@/features/payments/pages/PaymentDetailPage";
import { PaymentsPage } from "@/features/payments/pages/PaymentsPage";
import { ReconciliationPage } from "@/features/payments/pages/ReconciliationPage";
import { RefundsPage } from "@/features/payments/pages/RefundsPage";
import { PeakHoursPage } from "@/features/pricing/pages/PeakHoursPage";
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
import { RideLimitsPage } from "@/features/ride-config/pages/RideLimitsPage";
import { RideTypesPage } from "@/features/platform/pages/RideTypesPage";
import { VehiclesPage } from "@/features/platform/pages/VehiclesPage";
import { ZoneEditorPage, ZonesPage } from "@/features/platform/pages/ZonesPage";
import { SystemHealthPage } from "@/features/system/pages/SystemHealthPage";
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
      { path: "live-map", element: <LiveMapPage /> },
      { path: "pricing/peak-hours", element: <PeakHoursPage /> },
      { path: "drivers", element: <DriversPage /> },
      { path: "drivers/:id", element: <DriverDetailPage /> },
      { path: "driver-updates", element: <DriverChangesPage /> },
      { path: "driver-updates/:id", element: <DriverChangeDetailPage /> },
      { path: "rides", element: <RidesPage /> },
      { path: "rides/:id", element: <RideDetailPage /> },
      { path: "pricing", element: <PricingPage /> },
      // Tirvona Circuit
      { path: "circuits/packages", element: <CircuitPackagesPage /> },
      { path: "circuits/packages/new", element: <CircuitPackageEditorPage /> },
      { path: "circuits/packages/:id", element: <CircuitPackageEditorPage /> },
      { path: "circuits/bookings", element: <CircuitBookingsPage /> },
      { path: "circuits/bookings/:id", element: <CircuitBookingDetailPage /> },
      { path: "circuits/live", element: <LiveCircuitsPage /> },
      { path: "circuits/reports", element: <CircuitReportsPage /> },
      { path: "payments", element: <PaymentsPage /> },
      { path: "payments/refunds", element: <RefundsPage /> },
      { path: "payments/reconciliation", element: <ReconciliationPage /> },
      { path: "payments/:id", element: <PaymentDetailPage /> },
      { path: "commission", element: <CommissionPage /> },
      { path: "commission/:rideType", element: <CommissionRideTypePage /> },
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
      { path: "ride-limits", element: <RideLimitsPage /> },
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
      { path: "system-health", element: <SystemHealthPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
