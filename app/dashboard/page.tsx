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

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const workspace = await getWorkspace(user.workspaceSlug);
  // Stats is the slowest query (1.2 s): start it now, stream the cards behind <Suspense>,
  // and do not hold the table and toolbar for it (rule async-suspense-boundaries).
  const statsPromise = getLeadStats(workspace.id);
  // If the awaits below throw first, nobody awaits statsPromise: mark its rejection handled.
  // <Stats> still awaits the original promise and gets the error.
  statsPromise.catch(() => {});
  const [leads, sources] = await Promise.all([getLeads(workspace.id), getSourceBreakdown(workspace.id)]);

  const rows = leads.map(({ id, fullName, company, status, createdAt }) => ({
    id,
    fullName,
    company,
    status,
    createdAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ліди</h1>
        <p className="text-sm text-slate-500">
          Вітаємо, {user.name.split(" ")[0]}! Заявки з усіх каналів {workspace.name}.
        </p>
      </div>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <Stats statsPromise={statsPromise} />
      </Suspense>
      <LeadsToolbar sources={sources} />
      <LeadSearch />
      <LeadsTable leads={rows} />
    </div>
  );
}

async function Stats({ statsPromise }: { statsPromise: ReturnType<typeof getLeadStats> }) {
  return <StatsCards stats={await statsPromise} />;
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-[74px] rounded-lg border border-slate-200 bg-white p-4" />
      ))}
    </div>
  );
}
