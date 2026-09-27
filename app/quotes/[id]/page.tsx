import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { db } from "@/lib/db";
import type { QuoteStatus } from "@/lib/types";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });

const STATUS_VIEW: Record<QuoteStatus, { label: string; hint: string; className: string }> = {
  queued: {
    label: "У черзі",
    hint: "Запит прийнято, передаємо його на підготовку.",
    className: "bg-slate-100 text-slate-700",
  },
  processing: {
    label: "Готуємо кошторис",
    hint: "Зазвичай це займає одну-дві хвилини. Сторінка оновиться сама.",
    className: "bg-amber-100 text-amber-800",
  },
  ready: {
    label: "Готово",
    hint: "Кошторис готовий — його можна завантажити нижче.",
    className: "bg-emerald-100 text-emerald-800",
  },
  failed: {
    label: "Не вдалося підготувати",
    hint: "Щось пішло не так. Спробуйте надіслати запит ще раз або напишіть нам.",
    className: "bg-red-100 text-red-800",
  },
};

// The id is an unguessable token, so this page is public; it never shows the email or internal keys.
export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await db.getQuote(id);
  if (!quote) notFound();

  const view = STATUS_VIEW[quote.status];
  const pending = quote.status === "queued" || quote.status === "processing";

  return (
    <div className="space-y-6">
      {pending && <AutoRefresh />}

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Кошторис для {quote.company}</h1>
        <p className="text-sm text-slate-500">Запит від {dateTimeFormat.format(new Date(quote.createdAt))}</p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${view.className}`}>
          {view.label}
        </span>
        <p className="text-sm text-slate-600">{view.hint}</p>

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
          <Link href="/quotes/new" className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Надіслати запит ще раз
          </Link>
        )}
      </section>
    </div>
  );
}
