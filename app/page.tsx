import Link from "next/link";
import { LeadForm } from "@/components/lead-form";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Studio Nova</span>
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900">
            Вхід для команди
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-6 py-12 md:grid-cols-[1fr_1.2fr]">
        <section className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Розкажіть про ваш проєкт</h1>
          <p className="text-slate-600">
            Сайти, реклама та автоматизація для малого бізнесу. Залиште заявку — менеджер
            зв&apos;яжеться з вами протягом робочого дня.
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• Безкоштовна консультація 30 хвилин</li>
            <li>• Кошторис за 2 робочі дні</li>
            <li>• Працюємо з Україною та ЄС</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LeadForm />
        </section>
      </main>
    </div>
  );
}
