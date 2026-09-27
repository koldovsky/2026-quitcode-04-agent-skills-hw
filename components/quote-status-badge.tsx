import type { QuoteStatus } from "@/lib/types";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  queued: "Готуємо кошторис…",
  completed: "Кошторис готовий",
  failed: "Не вдалося підготувати кошторис",
};

const QUOTE_STATUS_STYLES: Record<QuoteStatus, string> = {
  queued: "bg-amber-50 text-amber-700 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${QUOTE_STATUS_STYLES[status]}`}
    >
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
