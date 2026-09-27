import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusBadge } from "@/components/quote-status-badge";
import { db } from "@/lib/db";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });
const usd = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// The workflow takes 40–90s and reports back via callback, not a page the
// user is sitting on — a plain refresh is the simplest way to reflect that
// without wiring up client-side polling for a single status field.
const REFRESH_SECONDS = 5;

export default async function QuoteStatusPage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await db.getQuoteRequest(id);

  if (!quote) notFound();

  return (
    <div className="flex flex-1 flex-col">
      {quote.status === "queued" && <meta httpEquiv="refresh" content={String(REFRESH_SECONDS)} />}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Studio Nova
          </Link>
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900">
            Вхід для команди
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-12">
        <Link href="/quotes/new" className="text-sm text-slate-500 hover:text-slate-900">
          ← Новий запит
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Кошторис для {quote.company}</h1>
            <p className="text-sm text-slate-500">{quote.id}</p>
          </div>
          <QuoteStatusBadge status={quote.status} />
        </div>

        {quote.status === "queued" && (
          <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <p className="text-slate-700">
              Готуємо кошторис. Зазвичай це займає 40–90 секунд, сторінка оновлюється сама.
            </p>
          </section>
        )}

        {quote.status === "completed" && quote.documentUrl && (
          <section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm">
            <p className="text-slate-700">Кошторис готовий.</p>
            <a
              href={quote.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Відкрити PDF
            </a>
          </section>
        )}

        {quote.status === "failed" && (
          <section className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-5 text-sm">
            <p className="text-slate-700">
              Не вдалося підготувати кошторис. Спробуйте надіслати запит ще раз або напишіть нам
              напряму.
            </p>
          </section>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium break-words">{quote.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Бюджет</dt>
            <dd className="font-medium">{quote.budget === null ? "—" : `${usd.format(quote.budget)} / міс.`}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Створено</dt>
            <dd className="font-medium">{dateTimeFormat.format(new Date(quote.createdAt))}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Оновлено</dt>
            <dd className="font-medium">{dateTimeFormat.format(new Date(quote.updatedAt))}</dd>
          </div>
        </dl>

        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-medium">Опис задачі</h2>
          <p className="whitespace-pre-line text-slate-700">{quote.description}</p>
        </section>
      </main>
    </div>
  );
}
