import type { QuoteStatus } from "@/lib/types";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  queued: "Готується",
  completed: "Готово",
  failed: "Помилка",
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  queued: "bg-sky-50 text-sky-700 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
