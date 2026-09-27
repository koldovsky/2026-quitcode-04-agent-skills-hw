import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { db } from "@/lib/db";
import type { QuoteStatus } from "@/lib/types";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const STATUS_TEXT: Record<QuoteStatus, { title: string; hint: string; className: string }> = {
  queued: {
    title: "Запит прийнято",
    hint: "Передаємо задачу на підготовку кошторису…",
    className: "border-slate-200 bg-white",
  },
  sent: {
    title: "Готуємо кошторис",
    hint: "Зазвичай це займає одну-дві хвилини. Сторінка оновиться сама.",
    className: "border-indigo-200 bg-indigo-50",
  },
  ready: {
    title: "Кошторис готовий",
    hint: "Завантажте PDF за посиланням нижче.",
    className: "border-emerald-200 bg-emerald-50",
  },
  failed: {
    title: "Не вдалося підготувати кошторис",
    hint: "Ми вже знаємо про проблему. Спробуйте ще раз трохи пізніше.",
    className: "border-red-200 bg-red-50",
  },
};

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = UUID_RE.test(id) ? await db.getQuote(id) : null;
  if (!quote) notFound();

  const text = STATUS_TEXT[quote.status];
  const pending = quote.status === "queued" || quote.status === "sent";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-12">
      {pending && <AutoRefresh />}

      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Studio Nova
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Кошторис для {quote.company}</h1>
        <p className="text-sm text-slate-500">Запит від {dateTimeFormat.format(new Date(quote.createdAt))}</p>
      </div>

      <section aria-live="polite" className={`space-y-2 rounded-lg border p-5 text-sm ${text.className}`}>
        <h2 className="flex items-center gap-2 font-medium">
          {pending && <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" aria-hidden />}
          {text.title}
        </h2>
        <p className="text-slate-700">
          {quote.status === "ready" && !quote.documentUrl
            ? "Посилання на PDF зараз недоступне — менеджер зв'яжеться з вами."
            : text.hint}
        </p>

        {quote.status === "ready" && quote.documentUrl && (
          <a
            href={quote.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Завантажити PDF
          </a>
        )}

        {quote.status === "failed" && (
          <Link href="/quotes/new" className="inline-block font-medium text-red-700 underline">
            Надіслати запит знову
          </Link>
        )}
      </section>
    </main>
  );
}
