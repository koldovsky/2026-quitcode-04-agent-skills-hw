import type { Metadata } from "next";
import { QuoteForm } from "@/components/quote-form";

export const metadata: Metadata = {
  title: "Запит на кошторис · Studio Nova",
};

export default function NewQuotePage() {
  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Запит на кошторис</h1>
        <p className="text-slate-600">
          Опишіть задачу — ми підготуємо PDF-кошторис з етапами, термінами та вартістю. Зазвичай це
          займає 1–2 хвилини.
        </p>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>• Кошторис ні до чого не зобов&apos;язує</li>
          <li>• Посилання на сторінку статусу можна зберегти й повернутися пізніше</li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <QuoteForm />
      </section>
    </div>
  );
}
