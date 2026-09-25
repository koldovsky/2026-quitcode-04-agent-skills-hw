import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusRefresh } from "@/components/quote-status-refresh";
import { db } from "@/lib/db";
import type { QuoteStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Статус кошторису · LeadDesk",
  // The link is the only key to the quote: keep it out of search engines.
  robots: { index: false, follow: false },
};

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });
const usd = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_TEXT: Record<QuoteStatus, { label: string; style: string }> = {
  queued: { label: "У черзі", style: "bg-sky-50 text-sky-700 ring-sky-200" },
  processing: { label: "Готуємо кошторис", style: "bg-amber-50 text-amber-700 ring-amber-200" },
  ready: { label: "Готово", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  failed: { label: "Не вдалося", style: "bg-red-50 text-red-700 ring-red-200" },
};

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await db.getQuote(id);
  if (!quote) notFound();

  const pending = quote.status === "queued" || quote.status === "processing";
  const status = STATUS_TEXT[quote.status];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-12">
      <Link href="/quotes/new" className="text-sm text-slate-500 hover:text-slate-900">
        ← Новий запит
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Кошторис для {quote.company}</h1>
          <p className="text-sm text-slate-500">Запит від {dateTimeFormat.format(new Date(quote.createdAt))}</p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.style}`}
        >
          {status.label}
        </span>
      </div>

      <section
        aria-live="polite"
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700"
      >
        {/* The waiting text lives in the client component: it changes when polling slows down or stops. */}
        {pending && <QuoteStatusRefresh createdAt={quote.createdAt} />}
        {/* The callback route stores "ready" only together with a checked https:// link. */}
        {quote.status === "ready" && quote.documentUrl && (
          <a
            href={quote.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Завантажити кошторис (PDF)
          </a>
        )}
        {quote.status === "failed" && (
          <p>
            Не вдалося підготувати кошторис автоматично.{" "}
            <Link href="/quotes/new" className="text-indigo-600 hover:underline">
              Спробуйте надіслати запит ще раз
            </Link>{" "}
            трохи пізніше.
          </p>
        )}
      </section>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Бюджет</dt>
          <dd className="font-medium">{usd.format(quote.budget)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Номер запиту</dt>
          <dd className="font-mono text-xs break-all">{quote.id}</dd>
        </div>
      </dl>
    </main>
  );
}
