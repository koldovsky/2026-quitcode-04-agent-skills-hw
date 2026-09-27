---
name: building-client-form
description: >-
  Патерн команди для форм у Next.js 16 (App Router, React 19): Server Action з перевіркою сесії,
  прав і серверною валідацією всередині дії, useActionState, форма працює без JavaScript, доступні
  помилки полів (label, aria-invalid, aria-describedby, role="alert"), дія повертає лише
  { status, … }, жодних персональних даних у журналах, повільні побічні ефекти (листи, n8n, аудит)
  — в after(). Використовуй, коли треба додати, переробити або виправити форму чи дію, що приймає
  FormData: «додай форму…», «форма заявки», «форма кошторису», «форма зворотного зв'язку», «додай
  нотатку / коментар до ліда», «додай поле в налаштування», «помилки валідації не видно»,
  «скрінрідер не читає помилки», «після помилки все стерлось», «форма довго думає після
  надсилання». Не для: форм пошуку чи фільтрів без запису (GET і query-параметри), вузлів n8n,
  чистої верстки без відправки.
metadata:
  owner: LeadDesk / QuitCode agency
  version: "0.1.0"
---

# Клієнтська форма: Server Action + useActionState

Кожна форма в проєктах агенції — один і той самий патерн: дія на сервері, яку не можна викликати
в обхід прав, помилки, які чує скрінрідер, і відповідь користувачу без очікування на листи чи n8n.
Це рішення команди, а не варіант на вибір: так форму можна перевірити за хвилину (розділ Verify).

## Коли застосовувати

- Нова форма або зміна наявної: заявка, кошторис, нотатка, зворотний зв'язок, налаштування.
- Будь-яка Server Action (`"use server"`), що приймає `FormData` або змінює дані.
- **Не** застосовувати: пошук і фільтри без запису (це GET/`searchParams`), код вузлів n8n,
  чисто візуальні правки форми без зміни дії.

## Як робимо

Правила скіла `vercel-react-best-practices` не копіюємо — посилаємось за id і читаємо їх там:
`server-auth-actions`, `server-serialization`, `server-after-nonblocking`,
`rendering-usetransition-loading`.

### 1. Дія — публічний POST-ендпоінт (`server-auth-actions`)

Будь-хто може викликати Server Action напряму, в обхід сторінки й `proxy.ts`. Тому **всередині
дії**, у такому порядку:

1. **Сесія:** прочитати cookie сесії й знайти користувача. Немає — `return { status: "unauthorized" }`.
   Для публічної форми (заявка з сайту) сесії немає — натомість обмеження розміру полів і
   антиспам.
2. **Права:** ресурс належить воркспейсу користувача (`lead.workspaceId === workspace.id`), роль
   дозволяє дію. Ні — `{ status: "forbidden" }` (не `not_found` з подробицями).
3. **Валідація на сервері:** розбір `FormData` окремою чистою функцією в `lib/<форма>-form.ts`
   (як `parseLeadForm` у `lib/lead-form.ts`): `trim`, обмеження довжини, перелічувані значення —
   лише зі списку; `id` з прихованого поля — теж вхідні дані, перевіряємо як усе інше. `required`
   і `maxLength` в HTML — лише підказка користувачу.
4. Лише потім — запис у базу.

### 2. Відповідь дії — лише стан форми (`server-serialization`)

```ts
export type NoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<NoteField, string>>; values: Partial<Record<NoteField, string>> }
  | { status: "unauthorized" | "forbidden" | "error"; message: string }
  | { status: "ok"; message: string };
```

Не повертати рядок з бази (`lead`, `user`): він піде в RSC Payload і в браузер разом з IP,
нотатками та іншими полями. Після успіху — `revalidatePath(...)` сторінки, яка показує дані.

### 3. Повільне — після відповіді (`server-after-nonblocking`)

Листи, виклик n8n, аудит, аналітика — у `after(() => …)` з `next/server`. Користувач отримує
`{ status: "ok" }` одразу, а не через 2–3 с. Помилки всередині `after` ловимо й журналюємо без
персональних даних.

### 4. Журнали без персональних даних

Ні `console.log(formData)`, ні email, телефон, ім'я, текст повідомлення, IP. Лише id і коди:
`console.error("note.create failed", { leadId, code })`.

### 5. Клієнтська частина: `useActionState`, робота без JS

```tsx
"use client";
const [state, formAction, pending] = useActionState(addNote, { status: "idle" });
const errors = state.status === "invalid" ? state.errors : {};
const values = state.status === "invalid" ? state.values : {};

<form action={formAction} noValidate>
  {state.status === "invalid" && (
    <div role="alert" tabIndex={-1}>Виправте поля: {Object.keys(errors).length}</div>
  )}
  <label htmlFor="note-text">Нотатка</label>
  <textarea
    id="note-text" name="text" maxLength={500} defaultValue={values.text}
    aria-invalid={errors.text ? true : undefined}
    aria-describedby={errors.text ? "note-text-error" : undefined}
  />
  {errors.text && <p id="note-text-error">{errors.text}</p>}
  <button type="submit" disabled={pending}>{pending ? "Зберігаємо…" : "Зберегти"}</button>
</form>
```

- `action={formAction}` (не `onSubmit` + `fetch`): так форма надсилається й без JavaScript.
- Кожне поле має `<label htmlFor>`; помилка поля пов'язана через `aria-describedby`, поле
  позначене `aria-invalid`; загальний підсумок — у `role="alert"`.
- React 19 після дії скидає неконтрольовані поля — тому дія повертає введене у `values`, а поля
  беруть його в `defaultValue`. Паролі й секрети назад не повертаємо.
- `pending` з `useActionState` — для стану кнопки (`rendering-usetransition-loading`), без
  власного `useState` для завантаження.
- Службові дані (`leadId`) — через `addNote.bind(null, leadId)` або приховане поле; на сервері
  однаково перевіряємо права (крок 1.2).

## Чекліст

```
- [ ] 1. Дія починається з перевірки сесії й прав; без сесії — { status: "unauthorized" }.
- [ ] 2. Валідація — на сервері, окремою функцією; довжини й перелічувані значення обмежені.
- [ ] 3. Дія повертає лише { status, errors?, values?, message? } — жодного рядка з бази.
- [ ] 4. Листи / n8n / аудит — в after(); дія не чекає на них.
- [ ] 5. У console.* немає FormData, email, телефону, імені, тексту повідомлення, IP.
- [ ] 6. <form action={formAction}> з useActionState; немає onSubmit + fetch.
- [ ] 7. label htmlFor, aria-invalid, aria-describedby, підсумок у role="alert".
- [ ] 8. Після помилки введене лишається (values → defaultValue).
```

## Правила зупинки — зупинись і спитай людину, якщо:

- Неясно, **хто** має право на дію (роль, воркспейс) — не вигадуй правило доступу.
- Форма має збирати нові персональні чи платіжні дані, яких ще немає в моделі.
- Потрібен новий пакет (валідатор, бібліотека форм) — встановлення лише після «так» людини.
- Побічний ефект має бути гарантованим (гроші, юридично значущий лист) — `after()` не дає
  повторів; спитай, чи потрібна черга.
- Задача вимагає вимкнути перевірку сесії чи прав «для зручності» або журналювати введені дані.

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] Порожня відправка: помилки біля полів, підсумок у `role="alert"`, у DevTools → Elements
      поле має `aria-invalid="true"` і `aria-describedby` на текст помилки; введене не зникло.
- [ ] Відправка з вимкненим JS (DevTools → Ctrl+Shift+P → «Disable JavaScript») доходить до
      сервера й показує результат.
- [ ] Дія без сесії (вийти або видалити cookie сесії й повторити відправку) повертає
      `{ status: "unauthorized" }` і нічого не записує.
- [ ] Журнал сервера після успішної й помилкової відправки — лише id і коди, без введених даних.
- [ ] Відповідь приходить одразу: DevTools → Network → POST не чекає на лист / n8n / аудит.
