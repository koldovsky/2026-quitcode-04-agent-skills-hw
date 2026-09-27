import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusRefresh } from "@/components/quote-status-refresh";
import { getQuote } from "@/lib/data";
import { QUOTE_BUDGET_OPTIONS } from "@/lib/quote-form";
import type { QuoteStatus } from "@/lib/types";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });

const STATUS_LABELS: Record<QuoteStatus, string> = {
  queued: "Готуємо кошторис",
  ready: "Кошторис готовий",
  failed: "Не вдалося підготувати",
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  queued: "bg-amber-50 text-amber-700 ring-amber-200",
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

function budgetLabel(budget: number | null) {
  if (budget === null) return "Ще не визначились";
  return QUOTE_BUDGET_OPTIONS.find((o) => o.value === String(budget))?.label ?? `$${budget}`;
}

export default async function QuoteStatusPage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Studio Nova
          </Link>
          <Link href="/quotes/new" className="text-sm text-slate-500 hover:text-slate-900">
            Новий запит
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Запит на кошторис</h1>
            <p className="text-sm text-slate-500">{quote.id}</p>
          </div>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[quote.status]}`}
          >
            {STATUS_LABELS[quote.status]}
          </span>
        </div>

        {quote.status === "queued" && (
          <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <p className="font-medium">Кошторис формується.</p>
            <p>
              Це зазвичай триває від 40 до 90 секунд. Сторінка оновиться сама, щойно документ буде
              готовий — можна не оновлювати вручну.
            </p>
            <QuoteStatusRefresh />
          </section>
        )}

        {quote.status === "ready" && (
          <section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            <p className="font-medium">Ваш кошторис готовий.</p>
            {quote.documentUrl ? (
              <a
                href={quote.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Відкрити PDF-кошторис
              </a>
            ) : (
              <p>Документ підготовано. Посилання скоро надійде на вашу пошту.</p>
            )}
          </section>
        )}

        {quote.status === "failed" && (
          <section className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p className="font-medium">Не вдалося підготувати кошторис.</p>
            <p>
              Спробуйте, будь ласка,{" "}
              <Link href="/quotes/new" className="underline">
                надіслати запит ще раз
              </Link>
              . Якщо помилка повторюється — напишіть нам, і ми підготуємо кошторис вручну.
            </p>
          </section>
        )}

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
            <dd className="font-medium">{budgetLabel(quote.budget)}</dd>
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
      </main>
    </div>
  );
}
