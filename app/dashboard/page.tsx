import { LeadSearch } from "@/components/lead-search";
import { LeadsTable, type LeadRow } from "@/components/leads-table";
import { LeadsToolbar } from "@/components/leads-toolbar";
import { StatsCards } from "@/components/stats-cards";
import {
  getCurrentUser,
  getLeadStats,
  getLeads,
  getSourceBreakdown,
  getWorkspace,
} from "@/lib/data";
import type { Lead } from "@/lib/types";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const workspace = await getWorkspace(user.workspaceSlug);
  // async-parallel: the three queries depend only on workspace.id, not on each other.
  const [leads, stats, sources] = await Promise.all([
    getLeads(workspace.id),
    getLeadStats(workspace.id),
    getSourceBreakdown(workspace.id),
  ]);

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
      <LeadsTable leads={leads.map(toLeadRow)} />
    </div>
  );
}

// server-serialization: LeadsTable is a Client Component, so every prop is serialized into the
// HTML and the RSC payload. Pass only the five fields the table renders — not rawPayload,
// internalNotes, ipAddress, userAgent, email or phone.
function toLeadRow({ id, fullName, company, status, createdAt }: Lead): LeadRow {
  return { id, fullName, company, status, createdAt };
}
