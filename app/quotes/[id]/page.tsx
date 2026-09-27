import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusRefresh } from "@/components/quote-status-refresh";
import { QUOTE_EXPECTED_MS, getQuote } from "@/lib/quotes";
import type { QuoteStatus } from "@/lib/types";

// Anyone with the link sees this page (the id is a random UUID), so it shows neither the email nor the
// task description, and isn't indexed.
export const metadata: Metadata = {
  title: "Статус кошторису · Studio Nova",
  robots: { index: false, follow: false },
};

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });
const usd = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_VIEW: Record<QuoteStatus, { label: string; title: string; text: string; badge: string }> = {
  queued: {
    label: "У черзі",
    title: "Запит прийнято",
    text: "Передаємо його в роботу. Сторінка оновиться сама.",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  processing: {
    label: "Готується",
    title: "Готуємо кошторис",
    text: "Зазвичай це займає 1–2 хвилини. Сторінка оновиться сама, а посилання можна зберегти й повернутися пізніше.",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  ready: {
    label: "Готово",
    title: "Кошторис готовий",
    text: "PDF відкриється в новій вкладці.",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  failed: {
    label: "Помилка",
    title: "Не вдалося підготувати кошторис",
    text: "Спробуйте надіслати запит ще раз трохи згодом.",
    badge: "bg-red-50 text-red-700 ring-red-200",
  },
};

function isOverdue(createdAt: string) {
  return Date.now() - Date.parse(createdAt) > QUOTE_EXPECTED_MS;
}

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const view = STATUS_VIEW[quote.status];
  const pending = quote.status === "queued" || quote.status === "processing";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {pending && <QuoteStatusRefresh />}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div role="status" className="space-y-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${view.badge}`}>
            {view.label}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
          <p className="text-slate-600">{view.text}</p>
          {pending && isOverdue(quote.createdAt) && (
            <p className="text-sm text-amber-700">
              Цього разу довше, ніж зазвичай. Можна закрити сторінку й повернутися за цим посиланням пізніше.
            </p>
          )}
        </div>

        {pending && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
            <Link href={`/quotes/${quote.id}`} className="underline hover:text-slate-900">
              Оновити статус
            </Link>
          </div>
        )}

        {quote.status === "ready" && quote.documentUrl && (
          <a
            href={quote.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Завантажити кошторис (PDF)
          </a>
        )}

        {quote.status === "failed" && (
          <Link
            href="/quotes/new"
            className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Надіслати запит ще раз
          </Link>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-sm">
        <h2 className="font-medium">Ваш запит</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Компанія</dt>
            <dd className="font-medium break-words">{quote.company}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Бюджет</dt>
            <dd className="font-medium">{quote.budget === null ? "не визначено" : usd.format(quote.budget)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Надіслано</dt>
            <dd className="font-medium">{dateTimeFormat.format(new Date(quote.createdAt))}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
