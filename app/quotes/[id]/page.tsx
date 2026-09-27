import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusRefresher } from "@/components/quote-status-refresher";
import { db } from "@/lib/db";
import type { QuoteStatus } from "@/lib/types";

// The page is reachable by anyone with the link (the id is a random UUID) — keep it out of search.
export const metadata: Metadata = { title: "Статус кошторису", robots: { index: false, follow: false } };

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });
const usd = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// The workflow takes 40–90 s; after this long without a callback we say it is taking longer.
const SLOW_AFTER_MS = 5 * 60 * 1000;

// A Server Component renders once per request (and per router.refresh()), so reading the clock is safe.
function isOverdue(createdAt: string) {
  return Date.now() - Date.parse(createdAt) > SLOW_AFTER_MS;
}

const STATUS_LABELS: Record<QuoteStatus, { label: string; className: string }> = {
  queued: { label: "У черзі", className: "bg-slate-100 text-slate-700" },
  processing: { label: "Готуємо кошторис", className: "bg-amber-100 text-amber-800" },
  ready: { label: "Готово", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Не вдалося", className: "bg-red-100 text-red-800" },
};

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await db.getQuote(id);
  if (!quote) notFound();

  const inProgress = quote.status === "queued" || quote.status === "processing";
  const slow = inProgress && isOverdue(quote.createdAt);
  const badge = STATUS_LABELS[quote.status];

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
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
      </div>

      <section
        aria-live="polite"
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm"
      >
        {inProgress && (
          <>
            <p>
              Готуємо PDF-кошторис — зазвичай це займає до двох хвилин. Сторінка оновиться сама.
            </p>
            {slow && (
              <p className="text-amber-700">
                Підготовка триває довше, ніж зазвичай. Можна закрити сторінку й повернутися за цим
                посиланням пізніше.
              </p>
            )}
          </>
        )}
        {quote.status === "ready" && quote.documentUrl && (
          <p>
            Кошторис готовий:{" "}
            <a
              href={quote.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              завантажити PDF
            </a>
          </p>
        )}
        {quote.status === "failed" && (
          <p className="text-red-700">
            Не вдалося підготувати кошторис автоматично. Менеджер зв&apos;яжеться з вами протягом
            робочого дня.
          </p>
        )}
      </section>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Компанія</dt>
          <dd className="font-medium break-words">{quote.company}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Бюджет</dt>
          <dd className="font-medium">{quote.budget === null ? "не визначено" : `${usd.format(quote.budget)} / міс.`}</dd>
        </div>
      </dl>

      {inProgress && <QuoteStatusRefresher />}
    </main>
  );
}
