import { Suspense } from "react";
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

// Placeholders reserve roughly the final height of each section to limit layout shift.
const statsFallback = (
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
    {Array.from({ length: 5 }, (_, i) => (
      <div key={i} className="h-[86px] animate-pulse rounded-lg border border-slate-200 bg-white" />
    ))}
  </div>
);
const toolbarFallback = <div className="h-[34px] w-80 max-w-full animate-pulse rounded-md bg-slate-200" />;
const tableFallback = <div className="h-96 animate-pulse rounded-lg border border-slate-200 bg-white" />;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const workspace = await getWorkspace({ slug: user.workspaceSlug });

  // Each section fetches its own data: the queries run in parallel and every section streams in as
  // soon as it is ready, instead of the whole page waiting for the slowest one (getLeadStats).
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ліди</h1>
        <p className="text-sm text-slate-500">
          Вітаємо, {user.name.split(" ")[0]}! Заявки з усіх каналів {workspace.name}.
        </p>
      </div>

      <Suspense fallback={statsFallback}>
        <Stats workspaceId={workspace.id} />
      </Suspense>
      <Suspense fallback={toolbarFallback}>
        <Toolbar workspaceId={workspace.id} />
      </Suspense>
      <LeadSearch />
      <Suspense fallback={tableFallback}>
        <Table workspaceId={workspace.id} />
      </Suspense>
    </div>
  );
}

async function Stats({ workspaceId }: { workspaceId: string }) {
  const stats = await getLeadStats(workspaceId);
  return <StatsCards stats={stats} />;
}

async function Toolbar({ workspaceId }: { workspaceId: string }) {
  const sources = await getSourceBreakdown(workspaceId);
  return <LeadsToolbar sources={sources} />;
}

async function Table({ workspaceId }: { workspaceId: string }) {
  const leads = await getLeads(workspaceId);
  return <LeadsTable leads={leads} />;
}
