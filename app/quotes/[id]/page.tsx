import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote, isFinalQuoteStatus, type QuoteStatus } from "@/lib/quotes";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });

const STATUS_TEXT: Record<QuoteStatus, { label: string; hint: string; className: string }> = {
  queued: {
    label: "У черзі",
    hint: "Запит прийнято, передаємо його в роботу.",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  processing: {
    label: "Готуємо кошторис",
    hint: "Зазвичай це займає 1–2 хвилини. Сторінка оновлюється сама.",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  completed: {
    label: "Готово",
    hint: "Кошторис готовий.",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  failed: {
    label: "Не вдалося",
    hint: "Не вдалося підготувати кошторис. Ми вже знаємо про це й зв'яжемося з вами.",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
};

// Public page: the id is a random UUID, and we show only the status and the document link —
// never the email or the task description.
export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const status = STATUS_TEXT[quote.status];
  const isFinal = isFinalQuoteStatus(quote.status);

  return (
    <div className="flex flex-1 flex-col">
      {/* Works without JS; React hoists it into <head>. Stops once the status is final. */}
      {!isFinal && <meta httpEquiv="refresh" content="5" />}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Studio Nova
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Кошторис для {quote.company}</h1>
            <p className="text-sm text-slate-500">Запит від {dateTimeFormat.format(new Date(quote.createdAt))}</p>
          </div>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}>
            {status.label}
          </span>
        </div>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm shadow-sm" aria-live="polite">
          <p className="text-slate-700">{status.hint}</p>
          {quote.status === "completed" && quote.documentUrl && (
            <a
              href={quote.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              Відкрити PDF-кошторис
            </a>
          )}
        </section>

        <Link href="/quotes/new" className="text-sm text-slate-500 hover:text-slate-900">
          Новий запит
        </Link>
      </main>
    </div>
  );
}
