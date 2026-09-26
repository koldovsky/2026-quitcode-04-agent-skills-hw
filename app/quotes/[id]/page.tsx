import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { QuoteStatusRefresher } from "@/components/quote-status-refresher";
import { db } from "@/lib/db";
import type { QuoteStatus } from "@/lib/types";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });
const usd = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_TEXT: Record<QuoteStatus, { title: string; hint: string; style: string }> = {
  queued: {
    title: "У черзі",
    hint: "Запит збережено, передаємо його на підготовку.",
    style: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  processing: {
    title: "Готуємо кошторис",
    hint: "Зазвичай це займає 1–2 хвилини.",
    style: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  ready: {
    title: "Готово",
    hint: "Кошторис підготовлено.",
    style: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  failed: {
    title: "Не вдалося підготувати",
    hint: "Ми вже знаємо про проблему. Спробуйте надіслати запит ще раз або напишіть нам.",
    style: "bg-red-50 text-red-700 ring-red-200",
  },
};

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  await connection(); // the status changes over time: never prerender or cache
  const { id } = await params;
  const quote = await db.getQuote(id);
  if (!quote) notFound();

  const status = STATUS_TEXT[quote.status];
  const inProgress = quote.status === "queued" || quote.status === "processing";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Studio Nova
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-12">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Кошторис для {quote.company}</h1>
          <p className="text-sm text-slate-500">
            Запит від {dateTimeFormat.format(new Date(quote.createdAt))}
            {quote.budget !== null && ` · бюджет до ${usd.format(quote.budget)}`}
          </p>
        </div>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm" aria-live="polite">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.style}`}>
            {status.title}
          </span>
          <p className="text-slate-600">{status.hint}</p>
          {quote.status === "ready" && quote.documentUrl && (
            <a
              href={quote.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              Завантажити PDF
            </a>
          )}
          {quote.status === "failed" && (
            <Link href="/quotes/new" className="inline-block text-indigo-600 hover:text-indigo-800">
              Надіслати новий запит →
            </Link>
          )}
        </section>

        {inProgress && <QuoteStatusRefresher createdAt={quote.createdAt} />}
      </main>
    </div>
  );
}
