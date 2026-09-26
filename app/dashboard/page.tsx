import { Suspense } from "react";
import { LeadSearch } from "@/components/lead-search";
import { LeadsTable } from "@/components/leads-table";
import { LeadsToolbar } from "@/components/leads-toolbar";
import { StatsCards, StatsCardsSkeleton } from "@/components/stats-cards";
import {
  getCurrentUser,
  getLeadStats,
  getLeads,
  getSourceBreakdown,
  getWorkspace,
} from "@/lib/data";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const workspace = await getWorkspace(user.workspaceSlug);

  // Each section streams in on its own: the slow stats query (1.2 s) no longer
  // holds back the header, search and table. Sibling boundaries fetch in parallel.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ліди</h1>
        <p className="text-sm text-slate-500">
          Вітаємо, {user.name.split(" ")[0]}! Заявки з усіх каналів {workspace.name}.
        </p>
      </div>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <DashboardStats workspaceId={workspace.id} />
      </Suspense>
      <Suspense fallback={<div className="h-8" />}>
        <DashboardToolbar workspaceId={workspace.id} />
      </Suspense>
      <LeadSearch />
      <Suspense fallback={<TableSkeleton />}>
        <DashboardTable workspaceId={workspace.id} />
      </Suspense>
    </div>
  );
}

async function DashboardStats({ workspaceId }: { workspaceId: string }) {
  return <StatsCards stats={await getLeadStats(workspaceId)} />;
}

async function DashboardToolbar({ workspaceId }: { workspaceId: string }) {
  return <LeadsToolbar sources={await getSourceBreakdown(workspaceId)} />;
}

async function DashboardTable({ workspaceId }: { workspaceId: string }) {
  const leads = await getLeads(workspaceId);
  return (
    <LeadsTable
      leads={leads.map(({ id, fullName, company, status, createdAt }) => ({
        id,
        fullName,
        company,
        status,
        createdAt,
      }))}
    />
  );
}

function TableSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg border border-slate-200 bg-white" aria-hidden="true" />;
}
