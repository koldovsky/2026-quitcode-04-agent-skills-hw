---
name: building-client-form
description: >-
  Team pattern for forms in Next.js 16 App Router + React 19: a Server Action that checks session,
  permissions and input inside itself, useActionState, a form that works without JavaScript,
  accessible field errors (label, aria-invalid, aria-describedby, role="alert" summary), input kept
  after an error, a response of only { status, ... }, no personal data in logs, slow side effects
  in after(). Use when adding or changing any form or its Server Action: lead or contact form,
  quote/estimate request, feedback, settings, a note or comment form on a dashboard page, or when
  form errors are invisible, not announced, or the typed input disappears. Тригери: «додай форму…»,
  «форма заявки», «форма кошторису», «форма зворотного зв'язку», «додай поле у форму»,
  «помилки валідації не видно», «після помилки все стерлось», «форма не працює без JS»,
  «Server Action для форми». Не для: суто стилів і верстки, клієнтських полів пошуку чи фільтрів
  без відправки на сервер, деталей контракту зовнішніх сервісів (n8n, CRM).
metadata:
  owner: QuitCode dev team
  version: "0.1.0"
---

# Форма в Next.js: патерн команди

Кожна форма агенції — публічний POST-ендпоінт з персональними даними. Тому вона робиться однаково:
перевірки — на сервері, помилки — доступні, відповідь — мінімальна, повільне — після відповіді.
Деталі правил продуктивності й безпеки — у скілі `vercel-react-best-practices` (посилання за id).

## Коли застосовувати

- Нова форма або зміна наявної: поля, валідація, Server Action, повідомлення про помилки.
- **Не** застосовувати: поле пошуку/фільтр без відправки; лише стилі; контракт зовнішнього сервісу —
  за правилами відповідного модуля чи скіла проєкту.

## Як робимо

Три файли на форму (імена — за сутністю: `quote`, `lead-note`…):

1. **`lib/<entity>-form.ts`** — чиста функція `parse<Entity>Form(formData)` →
   `{ ok: true, data } | { ok: false, errors, values }`. Для кожного поля: `trim()`, максимальна
   довжина (`slice` не мовчки — помилка, якщо довше), формат (email, число, значення зі списку).
   `values` — те, що ввів користувач (без файлів і секретів), щоб повернути його у форму.
2. **`app/…/actions.ts`** (`"use server"`) — Server Action **є публічним POST-ендпоінтом**, її може
   викликати будь-хто без UI (правило `server-auth-actions`). Порядок усередині, без винятків:
   1. сесія — `getCurrentUser()`/перевірка cookie; публічна форма без входу — пишемо це коментарем;
   2. права — ресурс (лід, воркспейс) належить користувачу; id з прихованих полів не довіряємо,
      перевіряємо в базі;
   3. валідація — `parse<Entity>Form`; помилки → `{ status: "invalid", errors, values }`;
   4. запис, від якого залежить користувач, — **до** відповіді;
   5. повільні побічні ефекти (лист, сповіщення, аудит, виклик інтеграції) — в `after()` з
      `next/server` (правило `server-after-nonblocking`); `after()` виконується навіть після
      помилки чи `redirect`, тож усередині — лише те, що безпечно завжди;
   6. `revalidatePath(...)` для сторінок, що показують ці дані;
   7. відповідь — **лише** `{ status: "ok", id? }` або `{ status: "invalid" | "error", … }`: не рядок з
      бази, не `rawPayload`, не стек чи SQL (правило `server-serialization`).
3. **`components/<entity>-form.tsx`** (`"use client"`):
   - `const [state, formAction, pending] = useActionState(action, initialState)`;
     `<form action={formAction}>` — **без** `onSubmit` з `preventDefault`: тоді форма працює й без
     JavaScript (React рендерить приховані поля дії і браузер робить звичайний POST: `$ACTION_ID_…`
     для простої дії, `$ACTION_REF_…` — для дії через `useActionState` або з `.bind(...)`);
   - у кожного поля `name`, `id` і `<label htmlFor>` (або обгортка `<label>`);
   - помилка поля: `aria-invalid={Boolean(errors.x)}`, `aria-describedby="x-error"` і
     `<p id="x-error">…</p>` поруч із полем;
   - над полями — підсумок `<div role="alert">` з кількістю помилок, коли `state.status === "invalid"`;
   - введене не зникає: React 19 скидає неконтрольовані поля після дії, тому
     `defaultValue={state.values?.x ?? ""}` (для `select` і `checkbox` — так само `defaultValue` /
     `defaultChecked`);
   - кнопка: `disabled={pending}` і текст «Надсилаємо…»; важкі бібліотеки у формі не імпортуємо
     (правило `bundle-dynamic-imports`).

## Журнали

Пишемо: подію, id запису, статус, тривалість. **Ніколи**: `formData`, `parsed.data`, ім'я, email,
телефон, текст повідомлення, IP, токени. `console.log(formData)` — заборонено навіть «тимчасово».

## Чекліст

```
- [ ] 1. Сесія, права й валідація — всередині Server Action, до будь-якого запису.
- [ ] 2. Дія повертає лише { status, ... } без рядків з бази.
- [ ] 3. <form action={formAction}> без preventDefault; у HTML є $ACTION_ID_ або $ACTION_REF_.
- [ ] 4. Кожне поле: label, name; помилка — aria-invalid + aria-describedby; є role="alert".
- [ ] 5. Після помилки введене лишається (defaultValue зі state.values).
- [ ] 6. Повільні побічні ефекти — в after(); у журналі немає персональних даних.
- [ ] 7. Довжини полів обмежені на сервері.
```

## Правила зупинки — зупинись і спитай людину, якщо:

- форма приймає файли або дані, яких немає в описі задачі (паспорт, картка, здоров'я);
- незрозуміло, хто має право відправляти форму чи змінювати ресурс (немає моделі прав);
- для валідації чи UI «треба» нова залежність (zod, react-hook-form) — спершу питання, не `npm install`;
- дані форми мають піти в сторонній сервіс, контракту якого в проєкті немає;
- зміна ламає наявні поля публічної форми (назви `name`, обов'язковість) — це зміна контракту.

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] Порожня відправка: біля кожного обов'язкового поля — текст помилки, зверху `role="alert"`,
      введене в інші поля лишилось.
- [ ] Без JS: `curl -s <url сторінки> | grep -oE 'name="\$ACTION_(ID|REF)_[^"]*"'` → знайдено (форма з
      `useActionState` дає `$ACTION_REF_`, тож пошук лише `$ACTION_ID_` її не бачить); і DevTools →
      Disable JavaScript → відправка працює.
- [ ] Дія без сесії (вийти й повторити запит, або curl без cookie) → дані не змінились.
- [ ] Журнал сервера після відправки: жодного email, телефону, імені чи тексту повідомлення.
- [ ] Відповідь форми не чекає повільних ефектів (DevTools → Network: POST < ~0,5 с без урахування
      бази).
