import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusRefresh } from "@/components/quote-status-refresh";
import { getQuoteStatus } from "@/lib/quotes";
import type { QuoteStatus } from "@/lib/types";

export const metadata = { title: "Статус кошторису · Studio Nova", robots: { index: false, follow: false } };

const STATUS_TEXT: Record<QuoteStatus, { label: string; hint: string; className: string }> = {
  queued: { label: "У черзі", hint: "Запит збережено, передаємо його в роботу.", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  processing: {
    label: "Готуємо кошторис",
    hint: "Зазвичай це займає 1–2 хвилини.",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  ready: { label: "Готово", hint: "Кошторис готовий.", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  failed: {
    label: "Не вдалося",
    hint: "Ми вже бачимо проблему й зв'яжемося з вами.",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
};

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });

export default async function QuoteStatusPage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await getQuoteStatus(id);
  if (!quote) notFound();

  const view = STATUS_TEXT[quote.status];
  const pending = quote.status === "queued" || quote.status === "processing";

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-6 py-12">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Studio Nova
      </Link>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Кошторис для {quote.company}</h1>
            <p className="text-sm text-slate-500">Запит від {dateTimeFormat.format(new Date(quote.createdAt))}</p>
          </div>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${view.className}`}>
            {view.label}
          </span>
        </div>
        <p className="text-sm text-slate-700" aria-live="polite">
          {view.hint}
        </p>
        {quote.status === "ready" && quote.documentUrl && (
          <a
            href={quote.documentUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Відкрити кошторис (PDF)
          </a>
        )}
        {pending && <QuoteStatusRefresh />}
      </div>
    </main>
  );
}
