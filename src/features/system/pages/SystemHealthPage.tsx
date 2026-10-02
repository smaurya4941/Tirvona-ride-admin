import { PageHeader } from "@/components/Ui";
import { SystemHealthCard } from "../components/SystemHealthCard";

export function SystemHealthPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="System Health" subtitle="Live API and dependency status" />
      <SystemHealthCard />
    </div>
  );
}
