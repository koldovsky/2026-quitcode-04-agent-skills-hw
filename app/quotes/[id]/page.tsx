import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { db } from "@/lib/db";
import type { QuoteStatus } from "@/lib/types";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });
const usd = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_TEXT: Record<QuoteStatus, { title: string; hint: string; className: string }> = {
  queued: {
    title: "У черзі",
    hint: "Запит збережено, передаємо його на підготовку.",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  processing: {
    title: "Готуємо кошторис",
    hint: "Зазвичай це займає до двох хвилин. Сторінка оновиться сама.",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  ready: {
    title: "Готово",
    hint: "Кошторис готовий.",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  failed: {
    title: "Не вдалося підготувати",
    hint: "Ми вже знаємо про проблему й зв'яжемося з вами. Можна також надіслати запит ще раз.",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
};

// Public page reachable by the unguessable id: shows the status, not the contact details.
export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await db.getQuote(id);
  if (!quote) notFound();

  const status = STATUS_TEXT[quote.status];
  const pending = quote.status === "queued" || quote.status === "processing";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-12">
      {pending && <AutoRefresh intervalMs={5000} />}

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Кошторис для {quote.company}</h1>
        <p className="text-sm text-slate-500">Запит від {dateTimeFormat.format(new Date(quote.createdAt))}</p>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}
        >
          {status.title}
        </span>
        <p className="text-sm text-slate-600">{status.hint}</p>
        {quote.status === "ready" && quote.documentUrl && (
          <a
            href={quote.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Завантажити PDF
          </a>
        )}
        {quote.status === "failed" && (
          <Link href="/quotes/new" className="inline-block text-sm text-indigo-600 hover:text-indigo-800">
            Надіслати новий запит
          </Link>
        )}
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-slate-500">Бюджет</dt>
        <dd>{quote.budget === null ? "не визначено" : `${usd.format(quote.budget)} / міс.`}</dd>
        <dt className="text-slate-500">Задача</dt>
        <dd className="whitespace-pre-line">{quote.description}</dd>
      </dl>
    </main>
  );
}
