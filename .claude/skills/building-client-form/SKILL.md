---
name: building-client-form
description: >-
  Патерн команди для форм у Next.js 16 (App Router, React 19): Server Action з перевіркою сесії, прав
  і валідацією всередині, useActionState, доступні помилки полів, відповідь лише { status, … },
  без персональних даних у журналах, повільні побічні ефекти — в after().
  Use when додаєш або переробляєш будь-яку форму, що відправляє дані на сервер: заявка, запит на
  кошторис, зворотний зв'язок, нотатка, налаштування, зміна статусу; коли пишеш чи рев'юїш Server
  Action для форми або бачиш, що помилки валідації не озвучуються чи введене зникає.
  Тригери: «додай форму…», «форма заявки», «форма зворотного зв'язку», «додати нотатку»,
  «зроби сабміт через Server Action», «помилки валідації не видно», «форма думає / довго надсилає».
  Не для чисто клієнтських фільтрів і пошуку без відправки на сервер і не для контракту з n8n
  (URL, заголовки, підпис колбека) — це окремі домовленості.
metadata:
  owner: studio-nova-dev
  version: "0.1.0"
---

# Клієнтська форма: патерн команди

Кожен проєкт агенції починається з форми, і кожна має однакові ризики: Server Action без перевірки
прав, помилки, яких не чує скрінрідер, `console.log(formData)`, лист, на який користувач чекає
3 секунди. Тому форма в нас завжди одна й та сама — нижче. Відхилення — лише свідомо, з поясненням у PR.

## Коли застосовувати

- Нова форма або зміна наявної, яка відправляє дані на сервер (публічна чи в дашборді).
- Рев'ю Server Action, що приймає `FormData`.
- **Не** застосовувати: пошук/фільтр без відправки, UI-стан без сервера; деталі виклику n8n — окремо.

## Як робимо

Три файли на форму (імена — за сутністю, напр. `note`):

| Файл | Що в ньому |
|---|---|
| `lib/<entity>-form.ts` | Тип полів, `parse<Entity>Form(formData)` → `{ ok: true, data } \| { ok: false, errors, values }`. Лише чиста валідація, без I/O — легко тестувати |
| `app/**/actions.ts` (`"use server"`) | Server Action — **публічний POST-ендпоінт** |
| `components/<entity>-form.tsx` (`"use client"`) | Розмітка з `useActionState` |

### 1. Server Action — порядок кроків фіксований

```ts
"use server";
export async function addNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const user = await getSessionUser();                 // 1. сесія — ВСЕРЕДИНІ дії
  if (!user) return { status: "unauthorized" };
  const parsed = parseNoteForm(formData);              // 2. валідація на сервері (клієнту не довіряємо)
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };
  const lead = await db.getLead(parsed.data.leadId);   // 3. права: запис належить workspace користувача
  if (!lead || lead.workspaceId !== user.workspaceId) return { status: "not_found" };
  await db.appendNote(lead.id, parsed.data.text);      // 4. критичний запис — ДО відповіді
  after(() => logAudit("note.added", lead.id));        // 5. повільне й необов'язкове — в after()
  revalidatePath(`/dashboard/leads/${lead.id}`);
  return { status: "ok" };                             // 6. лише статус (+ id за потреби)
}
```

- Кроки 1–3 — правило `server-auth-actions` зі скіла `vercel-react-best-practices` (не повторюємо
  його тут). `proxy.ts` чи перевірка в layout **не** захищають дію: її можна викликати напряму.
- Id сутності, яку змінюємо, приходить прихованим полем (`<input type="hidden" name="leadId">`) або
  через `.bind(null, id)` — і **все одно** перевіряється на кроці 3.
- Крок 5 — правило `server-after-nonblocking`: листи, n8n, аудит, аналітика не блокують відповідь.
  Server Actions виконуються по одній на клієнта — довга дія блокує наступну дію того ж користувача.
- Крок 6 — правило `server-serialization`: повертаємо `{ status, errors?, values?, id? }`, а **не**
  рядок з бази (там IP, user agent, внутрішні нотатки). Тип стану — дискримінований union за `status`.
- Помилки інфраструктури ловимо й повертаємо `{ status: "error" }` без подробиць (стек, SQL, URL).

### 2. Клієнтська форма

```tsx
"use client";
const [state, formAction, pending] = useActionState(addNote, { status: "idle" });
const errors = state.status === "invalid" ? state.errors : {};
const values = state.status === "invalid" ? state.values : {};
// <form action={formAction} noValidate> — працює й без JavaScript (progressive enhancement)
```

- `useActionState` + `<form action={formAction}>`. **Не** `onSubmit` + `fetch`, **не** `useState` для
  кожного поля — тоді форма відправляється й до гідратації, і без JS.
- Кнопка: `disabled={pending}`, текст «Надсилаємо…» під час відправки.
- Після `status: "ok"` — повідомлення про успіх (або скидання форми через `key`), а не тиха зміна.

### 3. Доступні помилки полів

Для кожного поля `name`:

```tsx
<label htmlFor="note-text">Нотатка</label>
<textarea id="note-text" name="text" defaultValue={values.text}
  aria-invalid={errors.text ? true : undefined}
  aria-describedby={errors.text ? "note-text-error" : undefined} />
{errors.text && <p id="note-text-error">{errors.text}</p>}
```

- Кожне поле має `<label>` (явний `htmlFor` або обгортка).
- Помилка поля: `aria-invalid` + `aria-describedby` на id тексту помилки.
- Підсумок над формою, якщо є помилки: `<div role="alert">Перевірте N поля</div>` — його озвучить скрінрідер.
- **Введене не зникає:** дія повертає `values` (обрізані, без паролів), поля отримують `defaultValue`.
  React 19 скидає неконтрольовану форму після дії — без `values` користувач втратить текст.
- Обмеження (`maxLength`, `required`) дублюємо в розмітці для підказки, але джерело правди — сервер.

### 4. Журнали

- Жодних персональних даних: не логуємо `formData`, тіло запиту, ім'я, email, телефон, IP, текст повідомлення.
- Логуємо подію, id запису, статус, тривалість: `console.info("note.added", { leadId })`.

## Чекліст

```
- [ ] 1. Server Action перевіряє сесію першим кроком і повертає {status:"unauthorized"} без неї
- [ ] 2. Валідація — на сервері, у чистій функції lib/<entity>-form.ts; довжини обмежені
- [ ] 3. Права перевіряються на конкретний запис (workspace/власник), id з форми не довіряємо
- [ ] 4. Дія повертає лише { status, errors?, values?, id? } — жодного рядка з бази
- [ ] 5. Форма на useActionState + <form action>, відправляється без JavaScript
- [ ] 6. Кожне поле з label; помилки через aria-invalid + aria-describedby; підсумок у role="alert"
- [ ] 7. Після помилки введене лишається в полях (values → defaultValue)
- [ ] 8. У журналах немає formData / email / телефону / імені / IP
- [ ] 9. Листи, n8n, аудит, аналітика — в after(), критичний запис — до відповіді
```

## Правила зупинки — зупинись і спитай людину, якщо:

- Дія має працювати **без** сесії (публічна форма), а в задачі не сказано, як захиститись від спаму
  (rate limit, honeypot) і в який workspace писати — не вигадуй.
- Для форми потрібна нова залежність (бібліотека валідації, форм) — встановлення лише після «так».
- Форма збирає нові категорії персональних даних (документи, дата народження, платіжні дані).
- Побічний ефект має бути гарантованим (оплата, юридично значущий лист) — `after()` не дає гарантії
  доставки; треба рішення людини (черга, колбек).

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] Порожня відправка → помилки біля полів + підсумок `role="alert"`; у DevTools поле має `aria-invalid="true"`.
- [ ] Помилка валідації не стирає введене в інших полях.
- [ ] DevTools → Disable JavaScript → форма відправляється й показує результат.
- [ ] Дія без сесії: `curl -X POST` на сторінку з заголовком `Next-Action` без cookie (або вихід із
      системи й повтор відправки) → `unauthorized`, у базі нічого не змінилось.
- [ ] Чужий запис: підміна прихованого id на запис іншого workspace → `not_found`.
- [ ] Журнал сервера після відправки: немає тексту форми, email, телефону.
- [ ] Час відповіді форми не включає повільних побічних ефектів (DevTools → Network → POST).
