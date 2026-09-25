import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusPoller } from "@/components/quote-status-poller";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });
const usd = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_LABEL = {
  queued: "Готуємо кошторис…",
  ready: "Кошторис готовий",
  failed: "Не вдалося підготувати кошторис",
} as const;

export default async function QuoteStatusPage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const request = await db.getQuoteRequest(id);
  if (!request) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-12">
      <Link href="/quotes/new" className="text-sm text-slate-500 hover:text-slate-900">
        ← Новий запит
      </Link>

      {request.status === "queued" && <QuoteStatusPoller />}

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{STATUS_LABEL[request.status]}</h1>
        <p className="text-sm text-slate-500">
          {request.id} · {dateTimeFormat.format(new Date(request.createdAt))}
        </p>
      </div>

      {request.status === "queued" && (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          Зазвичай це займає 40–90 секунд. Сторінка оновлюється автоматично.
        </p>
      )}

      {request.status === "ready" && request.documentUrl && (
        <a
          href={request.documentUrl}
          className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Завантажити кошторис (PDF)
        </a>
      )}

      {request.status === "failed" && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Спробуйте надіслати запит ще раз або напишіть нам напряму.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Компанія</dt>
          <dd className="font-medium break-words">{request.company}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium break-words">{request.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Бюджет</dt>
          <dd className="font-medium">{request.budget === null ? "—" : `${usd.format(request.budget)} / міс.`}</dd>
        </div>
      </dl>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-medium">Опис задачі</h2>
        <p className="whitespace-pre-line text-slate-700">{request.taskDescription}</p>
      </section>
    </div>
  );
}
