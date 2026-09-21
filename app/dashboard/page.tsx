import { LeadSearch } from "@/components/lead-search";
import { LeadsTable } from "@/components/leads-table";
import { LeadsToolbar } from "@/components/leads-toolbar";
import { StatsCards } from "@/components/stats-cards";
import {
  getCurrentUser,
  getLeadStats,
  getLeads,
  getSourceBreakdown,
  getWorkspace,
} from "@/lib/data";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const workspace = await getWorkspace({ slug: user.workspaceSlug });
  const leads = await getLeads(workspace.id);
  const stats = await getLeadStats(workspace.id);
  const sources = await getSourceBreakdown(workspace.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ліди</h1>
        <p className="text-sm text-slate-500">
          Вітаємо, {user.name.split(" ")[0]}! Заявки з усіх каналів {workspace.name}.
        </p>
      </div>

      <StatsCards stats={stats} />
      <LeadsToolbar sources={sources} />
      <LeadSearch />
      <LeadsTable leads={leads} />
    </div>
  );
}
