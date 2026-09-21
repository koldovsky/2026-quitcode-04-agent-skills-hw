import type { LeadStatus } from "@/lib/types";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новий",
  contacted: "Контакт",
  qualified: "Кваліфікований",
  won: "Угода",
  lost: "Втрачений",
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-sky-50 text-sky-700 ring-sky-200",
  contacted: "bg-amber-50 text-amber-700 ring-amber-200",
  qualified: "bg-violet-50 text-violet-700 ring-violet-200",
  won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  lost: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
