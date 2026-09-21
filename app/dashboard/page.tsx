import { Suspense } from "react";
import { DashboardStats, StatsCardsSkeleton } from "@/components/dashboard-stats";
import { LeadSearch } from "@/components/lead-search";
import { LeadsTable } from "@/components/leads-table";
import { LeadsToolbar } from "@/components/leads-toolbar";
import {
  getCurrentUser,
  getLeadList,
  getLeadStats,
  getSourceBreakdown,
  getWorkspace,
} from "@/lib/data";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const workspace = await getWorkspace(user.workspaceSlug);
  // Stats take ~1.2 s: start them now, but do not block the page on them.
  const stats = getLeadStats(workspace.id);
  const [leads, sources] = await Promise.all([getLeadList(workspace.id), getSourceBreakdown(workspace.id)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ліди</h1>
        <p className="text-sm text-slate-500">
          Вітаємо, {user.name.split(" ")[0]}! Заявки з усіх каналів {workspace.name}.
        </p>
      </div>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <DashboardStats stats={stats} />
      </Suspense>
      <LeadsToolbar sources={sources} />
      <LeadSearch />
      <LeadsTable leads={leads} />
    </div>
  );
}
