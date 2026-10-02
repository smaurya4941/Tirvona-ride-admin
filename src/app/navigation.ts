import {
  Activity,
  Ban,
  Banknote,
  BarChart3,
  Bell,
  Car,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  LifeBuoy,
  Map as MapIcon,
  MapPinned,
  Megaphone,
  MapPin,
  Palette,
  Percent,
  Receipt,
  Scale,
  ShieldAlert,
  Tags,
  Ticket,
  Truck,
  Undo2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

// Phase 7 structure. KYC review lives on Drivers (Under review filter); live
// rides on Rides (active filters) and the dashboard's live-operations cards.
export const navigation: NavSection[] = [
  { items: [{ label: "Dashboard", path: "/", icon: LayoutDashboard }] },
  {
    title: "Operations",
    items: [
      { label: "Rides", path: "/rides", icon: MapPinned },
      { label: "Drivers & KYC", path: "/drivers", icon: Car },
      { label: "Driver updates", path: "/driver-updates", icon: FileCheck2 },
      { label: "Customers", path: "/customers", icon: Users },
      { label: "Vehicles", path: "/vehicles", icon: Truck },
      { label: "Cancellations", path: "/cancellations", icon: Ban },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Ride types", path: "/ride-types", icon: Tags },
      { label: "Pricing", path: "/pricing", icon: Receipt },
      { label: "Zones", path: "/zones", icon: MapIcon },
      { label: "Popular places", path: "/popular-places", icon: MapPin },
      { label: "Branding", path: "/branding", icon: Palette },
      { label: "System health", path: "/system-health", icon: Activity },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payments", path: "/payments", icon: Receipt },
      { label: "Refunds", path: "/payments/refunds", icon: Undo2 },
      { label: "Reconciliation", path: "/payments/reconciliation", icon: Scale },
      { label: "Commission", path: "/commission", icon: Percent },
      { label: "Driver earnings", path: "/earnings", icon: Banknote },
    ],
  },
  { title: "Growth", items: [{ label: "Promo codes", path: "/promotions", icon: Ticket }] },
  {
    title: "Communication",
    items: [
      { label: "Broadcasts", path: "/broadcasts", icon: Megaphone },
      { label: "Inbox", path: "/notifications", icon: Bell },
    ],
  },
  {
    title: "Safety & support",
    items: [
      { label: "SOS / incidents", path: "/safety", icon: ShieldAlert },
      { label: "Complaints", path: "/complaints", icon: LifeBuoy },
    ],
  },
  {
    title: "Analytics",
    items: [
      { label: "Reports", path: "/reports", icon: BarChart3 },
      { label: "Audit log", path: "/audit-log", icon: ClipboardList },
    ],
  },
];
