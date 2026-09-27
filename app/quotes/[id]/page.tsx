import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/data";
import { QuoteStatusBadge } from "@/components/quote-status-badge";
import { QuoteStatusPoller } from "@/components/quote-status-poller";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });

export default async function QuoteStatusPage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-12">
      <Link href="/quotes/new" className="text-sm text-slate-500 hover:text-slate-900">
        ← Новий запит
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Запит на кошторис</h1>
          <p className="text-sm text-slate-500">{quote.id}</p>
        </div>
        <QuoteStatusBadge status={quote.status} />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Компанія</dt>
          <dd className="font-medium break-words">{quote.company}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium break-words">{quote.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Бюджет</dt>
          <dd className="font-medium">{quote.budget === null ? "—" : `$${quote.budget}`}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Створено</dt>
          <dd className="font-medium">{dateTimeFormat.format(new Date(quote.createdAt))}</dd>
        </div>
      </dl>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-medium">Опис задачі</h2>
        <p className="whitespace-pre-line text-slate-700">{quote.description}</p>
      </section>

      {quote.status === "queued" && (
        <>
          <p className="text-sm text-slate-500">
            Кошторис готується — зазвичай це займає від 40 секунд до кількох хвилин. Сторінка
            оновиться автоматично.
          </p>
          <QuoteStatusPoller />
        </>
      )}

      {quote.status === "completed" && quote.documentUrl && (
        <a
          href={quote.documentUrl}
          className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Завантажити кошторис
        </a>
      )}

      {quote.status === "failed" && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Не вдалося підготувати кошторис. Спробуйте надіслати запит ще раз або зв&apos;яжіться з
          нами напряму.
        </p>
      )}
    </div>
  );
}
