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
  version: "0.3.0"
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

1. **Сесія:** прочитати cookie сесії й знайти користувача хелпером, який повертає `null`, а не
   робить `redirect` (хелпер для сторінок, що перенаправляє на вхід, у дії не підходить: форма
   отримала б сторінку входу замість стану). Немає — `return { status: "unauthorized" }`.
   Для публічної форми (заявка з сайту) сесії немає — натомість обмеження розміру полів і
   антиспам.
2. **Права:** ресурс належить воркспейсу користувача (`lead.workspaceId === workspace.id`), роль
   дозволяє дію. Ні — `{ status: "forbidden" }` (не `not_found` з подробицями).
3. **Валідація на сервері:** розбір `FormData` окремою чистою функцією в `lib/<форма>-form.ts`:
   `trim`, обмеження довжини, перелічувані значення —
   лише зі списку; `id` з прихованого поля — теж вхідні дані, перевіряємо як усе інше. `required`
   і `maxLength` в HTML — лише підказка користувачу.
4. Лише потім — запис у базу.

### 2. Відповідь дії — лише стан форми (`server-serialization`)

```ts
type Values = Partial<Record<NoteField, string>>;

export type NoteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<NoteField, string>>; values: Values }
  | { status: "unauthorized" | "forbidden" | "error"; message: string; values: Values }
  | { status: "ok"; message: string };
```

`values` — у **кожному** стані помилки: React 19 скидає форму після будь-якої дії, тож без них
нотатка зникне й після «сесія завершилась» чи «не вдалося зберегти». Лише `ok` дає формі
скинутись. Не повертати рядок з бази (`lead`, `user`): він піде в RSC Payload і в браузер разом
з IP, нотатками та іншими полями. Після успіху — `revalidatePath(...)` сторінки, яка показує дані.

### 3. Повільне — після відповіді (`server-after-nonblocking`)

Листи, виклик n8n, аудит, аналітика — у `after(() => …)` з `next/server`. Користувач отримує
`{ status: "ok" }` одразу, а не через 2–3 с. Помилки всередині `after` ловимо й журналюємо без
персональних даних.

### 4. Журнали без персональних даних

Ні `console.log(formData)`, ні email, телефон, ім'я, текст повідомлення, IP. Лише id і коди:
`console.error("note.create failed", { leadId, code })`.

`next dev` сам журналює назву, аргументи й тривалість кожної Server Action (`└─ ƒ addNote({…})`;
`logging.md` у документації Next.js 16), тож введене видно в терміналі розробника; у `next start`
цього немає. Перевіряй журнал на
продакшн-збірці; `logging: { serverFunctions: false }` у `next.config.ts` — налаштування всього
проєкту, лише після «так» людини.

### 5. Клієнтська частина: `useActionState`, робота без JS

```tsx
"use client";
const [state, formAction, pending] = useActionState(addNote, { status: "idle" });
const errors = state.status === "invalid" ? state.errors : {};
const values = "values" in state ? state.values : {};

<form action={formAction} noValidate>
  <input type="hidden" name="leadId" value={leadId} />
  {state.status === "invalid" && (
    <p role="alert">Виправте поля: {Object.keys(errors).length}</p>
  )}
  {"message" in state && state.status !== "ok" && <p role="alert">{state.message}</p>}
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
- React 19 після дії скидає неконтрольовані поля — тому дія повертає введене у `values` при
  будь-якій помилці, а поля беруть його в `defaultValue`. Введене не обрізаємо: користувач сам
  скоротить текст. Паролі й секрети назад не повертаємо.
- `pending` з `useActionState` — для стану кнопки (`rendering-usetransition-loading`), без
  власного `useState` для завантаження.
- Службові дані (`leadId`) — прихованим полем, як у прикладі; на сервері це звичайний вхід,
  права перевіряємо (крок 1.2). Документація Next.js 16 (`02-guides/forms.md`, «Passing
  additional arguments») допускає і приховане поле, і `.bind()`. Команда бере приховане поле:
  `.bind()` у Client Component з `useActionState` без JavaScript у нас зависав (відтворення —
  розділ «У LeadDesk» нижче).

## Чекліст

```
- [ ] 1. Дія над даними користувача починається з перевірки сесії й прав; без сесії —
        { status: "unauthorized" }. Публічна форма (заявка з сайту) — без сесії, але з
        обмеженням розміру полів і антиспамом.
- [ ] 2. Валідація — на сервері, окремою функцією; довжини й перелічувані значення обмежені.
- [ ] 3. Дія повертає лише { status, errors?, values?, message? } — жодного рядка з бази.
- [ ] 4. Листи / n8n / аудит — в after(); дія не чекає на них.
- [ ] 5. У console.* немає FormData, email, телефону, імені, тексту повідомлення, IP.
- [ ] 6. <form action={formAction}> з useActionState; немає onSubmit + fetch.
- [ ] 7. label htmlFor, aria-invalid, aria-describedby, підсумок у role="alert".
- [ ] 8. Після будь-якої помилки (invalid / unauthorized / forbidden / error) введене лишається
        (values → defaultValue).
```

## Правила зупинки — зупинись і спитай людину, якщо:

- Неясно, **хто** має право на дію (роль, воркспейс) — не вигадуй правило доступу.
- Форма має збирати нові персональні чи платіжні дані, яких ще немає в моделі.
- Потрібен новий пакет (валідатор, бібліотека форм) — встановлення лише після «так» людини.
- Побічний ефект має бути гарантованим (гроші, юридично значущий лист) — `after()` не дає
  повторів; спитай, чи потрібна черга.
- Задача вимагає вимкнути перевірку сесії чи прав «для зручності» або журналювати введені дані.

## У LeadDesk

Патерн вище — для будь-якого проєкту агенції. У LeadDesk він уже має свої назви:

- Сесія в дії — `getSessionUser()` з `lib/data.ts` (повертає `null`); `getCurrentUser()` — лише
  для сторінок, перенаправляє на `/login`.
- Права на лід — `authorizeLead()` в `app/actions.ts` (сесія → воркспейс → лід).
- Розбір форм — `lib/lead-form.ts`, `lib/note-form.ts`, `lib/quote-form.ts`.
- Антиспам публічних форм — honeypot: `components/honeypot-field.tsx` у формі, `isHoneypotFilled()`
  з `lib/honeypot.ts` у дії після валідації й до запису (`submitLead`, `requestQuote`).
- `.bind()` без JS (Next.js 16.3.5, React 19.2.8): `useActionState(addNote.bind(null, leadId), …)`
  записав нотатку, але не повернув сторінку (POST без відповіді 20 с). Відтворення:
  `npm run build && npm start`, форму надіслати звичайним multipart POST з полями `$ACTION_*` із
  серверного HTML.

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] Порожня відправка: помилки біля полів, підсумок у `role="alert"`, у DevTools → Elements
      поле має `aria-invalid="true"` і `aria-describedby` на текст помилки.
- [ ] Невалідне **непорожнє** значення (у DevTools прибрати `maxLength` і вставити на 1 символ
      більше за ліміт): помилка біля поля, весь введений текст лишився в полі.
- [ ] Відправка з вимкненим JS (DevTools → Ctrl+Shift+P → «Disable JavaScript» → **F5**) доходить
      до сервера й показує результат. Без перезавантаження форма лишається гідрованою
      (`action="javascript:throw …"`) і нічого не відправляє.
- [ ] Публічна форма (без сесії): заповніть у DevTools приховане антиспам-поле й надішліть — запису
      немає (у журналі без `db:<запис>`), `role="alert"` із загальним повідомленням, введене лишилось;
      з порожнім полем — звичайний успіх.
- [ ] Дія, що вимагає сесії, — без сесії: у DevTools → Application → Cookies **змініть** значення cookie сесії на
      вигадане й повторіть відправку — форма показує `unauthorized`, введене лишилось, у журналі
      немає запису (`db:<запис>`). Якщо cookie **видалити**, `proxy.ts` перенаправить POST на
      `/login`, і в dev буде «An unexpected response was received from the server» — дію це не
      перевіряє.
- [ ] Чужий ресурс: увійти користувачем іншого воркспейсу й підмінити в DevTools приховане поле
      (`leadId`) на id чужого запису — `forbidden`, у журналі немає запису.
- [ ] Журнал сервера (`npm run build && npm start`) після успішної й помилкової відправки — лише
      id і коди, без введених даних.
- [ ] Відповідь приходить одразу: DevTools → Network → POST не чекає на лист / n8n / аудит.
