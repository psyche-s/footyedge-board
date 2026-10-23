import Dashboard from "@/components/Dashboard";
import initialData from "@/data/dashboard.json";
import type { DashboardData } from "@/lib/types";

export default function Page() {
  return <Dashboard initialData={initialData as DashboardData} />;
}
