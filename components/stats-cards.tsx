import type { LeadStats } from "@/lib/types";

const percent = new Intl.NumberFormat("uk-UA", { style: "percent", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function StatsCards({ stats }: { stats: LeadStats }) {
  const cards = [
    { label: "Усього лідів", value: String(stats.total) },
    { label: "Нові", value: String(stats.byStatus.new) },
    { label: "За 7 днів", value: String(stats.last7Days) },
    { label: "Конверсія", value: percent.format(stats.conversionRate) },
    { label: "Середній бюджет", value: usd.format(stats.averageBudget) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
