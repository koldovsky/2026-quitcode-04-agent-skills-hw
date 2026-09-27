import Link from "next/link";
import { QuoteForm } from "@/components/quote-form";

export default function NewQuotePage() {
  return (
    <div className="flex flex-1 flex-col">
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
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Запит на кошторис</h1>
          <p className="text-slate-600">
            Опишіть задачу — підготуємо PDF-кошторис і надішлемо посилання на нього. Зазвичай це
            займає 1–2 хвилини.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <QuoteForm />
        </section>
      </main>
    </div>
  );
}
