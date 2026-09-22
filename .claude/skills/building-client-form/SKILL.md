---
name: building-client-form
description: >-
  Командний патерн QuitCode для форм у Next.js App Router: Server Action з автентифікацією й
  валідацією всередині, useActionState, доступні помилки полів (label, aria-invalid,
  aria-describedby, role="alert"), введені значення не зникають після помилки, дія повертає лише
  { status, … }, жодних персональних даних у журналах, повільні побічні ефекти — в after().
  Use when creating or changing any form that submits to the server in a Next.js app: lead, contact,
  quote, signup, settings or dashboard forms and the Server Action behind them. Тригери: «додай форму»,
  «форма заявки», «форма запиту», «форма зворотного зв'язку», «зроби форму для …», «валідація полів»,
  «помилки валідації не видно», «форма стирає введене», «Server Action для форми». Не для форм без
  сервера (фільтри й пошук на клієнті).
metadata:
  owner: quitcode
  version: "1.0.0"
---

# Форма з Server Action (патерн команди)

Форма — найчастіше місце, де агент «швидко робить як вийде»: дія без перевірки прав, помилки, яких
не чує скрінрідер, `console.log(formData)`, лист клієнту, який користувач чекає 3 секунди. Цей патерн
закриває ці місця однаково в усіх проєктах. Він спирається на правила скіла Vercel React Best
Practices (`vercel-react-best-practices`) — посилаюсь на них за id, не переписую.

## Структура: три файли

| Файл | Що в ньому |
|---|---|
| `lib/<name>-form.ts` | Чистий модуль (без `"use server"`/`"use client"`): тип стану, імена полів, ліміти довжин, списки дозволених значень, `parse<Name>Form(formData)` → `{ ok: true, data }` або `{ ok: false, errors, values }` |
| `app/<route>/actions.ts` | `"use server"`; дія `(prev: State, formData: FormData) => Promise<State>` |
| `components/<name>-form.tsx` | `"use client"`; `useActionState(action, { status: "idle" })` |

Тип стану — дискримінований союз, лише прості значення:

```ts
export type QuoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteField, string>>; values: Partial<Record<QuoteField, string>> }
  | { status: "error"; message: string; values: Partial<Record<QuoteField, string>> }
  | { status: "ok"; id: string };
```

## Server Action — у такому порядку

1. **Сесія й права** (для непублічних форм): поточний користувач і належність запису до його
   workspace перевіряються **всередині дії** — `server-auth-actions`. Server Action — публічний
   POST-ендпоінт; перевірка в `proxy.ts` чи на сторінці його не захищає.
2. **Валідація на сервері**: `parse<Name>Form` — обрізати пробіли й довжини, `select` лише зі списку,
   числа через список або `Number.isFinite`. Клієнтській валідації не довіряємо.
3. **Швидка мутація** (запис у БД) у `try/catch` → при збої `{ status: "error", message, values }`
   з людським текстом, без стеку.
4. **Повільне — в `after()`** з `next/server`: листи, n8n, аудит, аналітика — `server-after-nonblocking`.
   Для n8n — скіл `integrating-n8n-webhooks`.
5. `revalidatePath(...)`, якщо дані видно на інших сторінках.
6. **Повернути лише `{ status, … }`**: `id` створеного запису, помилки полів і `values` — тільки те,
   що ввів сам користувач (без паролів). Ніколи — рядок із БД, внутрішні поля, стек.

## Client Component

- `<form action={formAction} noValidate>` — працює й без JavaScript (progressive enhancement), а
  повідомлення про помилки однакові, бо їх дає сервер.
- Кожне поле: `<label htmlFor>` + `id`, `name`, доречний `autoComplete` і `type`.
- **Введене не зникає**: React 19 після дії скидає неконтрольовані поля, тому
  `defaultValue={values.<field>}` зі стану. Для `<select>` цього мало: змонтований select тримає
  перший `defaultValue` і після скидання повертається до першої опції — додай
  `key={values.<field> ?? ""}`, щоб він перемонтувався зі значенням від сервера (перевірено в браузері
  на Next.js 16.3.5 / React 19.2.8). Checkbox — так само `key` + `defaultChecked`.
- **Помилки доступні**: `aria-invalid={Boolean(errors.x)}`, `aria-describedby="x-error"` лише коли
  помилка є, текст помилки в `<p id="x-error">`. Над кнопкою — підсумок у `role="alert"`
  («Перевірте 2 поля») або текст `error`.
- Кнопка: `disabled={pending}`, текст «Надсилаємо…». Жодних `useEffect` для станів форми.
- Успіх: окремий стан із наступним кроком (подяка, посилання на створений запис) або `redirect()`
  у дії, якщо далі окрема сторінка.
- Початкові дані — пропсами з Server Component, лише потрібні поля (`server-serialization`), не
  `fetch` у `useEffect` (`client-swr-dedup`); похідні значення рахуй під час рендеру
  (`rerender-derived-state-no-effect`). Важкі віджети (редактор, календар) — `next/dynamic` у
  клієнтському файлі (`bundle-dynamic-imports`).

## Журнали й приватність

- Ніколи не логуй `formData`, `values`, `parsed.data` чи email/телефон. Пишемо: назва дії, результат
  (`ok` / `invalid` + **імена** полів із помилками), id запису, тривалість.
- Персональні дані — не в query string і не в `NEXT_PUBLIC_*`.
- Нових залежностей (react-hook-form, zod…) не додавай без запиту; якщо zod уже є в проєкті —
  використовуй його в `lib/<name>-form.ts`.

## Verify — форма готова, коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] Порожня відправка: помилки біля полів, підсумок у `role="alert"`, введене не зникло,
      `aria-invalid`/`aria-describedby` на полях з помилками (перевір у DOM або через
      Accessibility-панель браузера).
- [ ] Валідна відправка: відповідь < 1 с навіть якщо побічні ефекти повільні (вони в `after()`).
- [ ] Без JavaScript (вимкнений JS або `curl` з полями форми) форма теж відправляється.
- [ ] Непублічна форма: дія, викликана напряму без сесії або для чужого запису, нічого не змінює
      (напр., POST із заголовком `next-action` з `.next/server/server-reference-manifest.json`).
- [ ] У відповіді дії й у журналі сервера немає даних, яких користувач не вводив, і немає його email,
      телефону чи тексту повідомлення.
