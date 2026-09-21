import type { LeadStats } from "@/lib/types";
import { StatsCards } from "./stats-cards";

// The page starts the query and passes the promise down, so the slow stats run in
// parallel with the rest of the page and stream in behind a <Suspense> boundary.
export async function DashboardStats({ stats }: { stats: Promise<LeadStats> }) {
  return <StatsCards stats={await stats} />;
}

export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-busy="true" aria-label="Завантажуємо статистику">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-[74px] animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
      ))}
    </div>
  );
}
