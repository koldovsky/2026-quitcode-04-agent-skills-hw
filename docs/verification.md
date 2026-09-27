# Перевірка (Task A–C, бонус E3)

> Скопіюйте в `docs/verification.md` і заповніть. Сюди — лише те, що справді сталося: цитати,
> числа, імена файлів, SHA комітів. Порядок дій — у `docs/walkthrough.md`.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Claude Code 2.1.283 (розширення VS Code) · Opus 5.5
- **ОС і термінал, Node:** Windows 11 Home · Git Bash · Node 24.12.0

## Скіли видно у свіжій сесії

- Як перевіряли: `/skills` у новій сесії Claude Code (VS Code).

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | `/vercel-react-best-practices` · project · ~120 tokens; 75 файлів у `.claude/skills/`, коміт `8bc9f78` |
| `building-client-form` | Project | спрацював у свіжій сесії без назви (Task B) |
| `integrating-n8n-webhooks` | | Task C |

- Особисті скіли, які теж видно (`~/.claude/skills/`…), і чи можуть вони вплинути на перевірки:
  у `~/.claude/skills/` — `find-skills`, `postgres-migrations`, `synced`. На Task A не впливають
  (не про React/Next.js); перед прогонами Task D їх треба врахувати — у прогоні A вони будуть видні.

## Task A — виправлення за скілом Vercel

Рев'ю зроблено в новій сесії запитом «Зроби рев'ю app/, components/, lib/ за скілом
vercel-react-best-practices… Файли не змінюй»: 17 знахідок. Застосовано 2, **обидва — з числами**.

**Як міряли:** продакшн-збірка (`npm run build`, потім `npx next start -p 3001` — на `:3000` працював
`npm run dev`); cookie `leaddesk_session=demo-u_olena`; `curl` на `/dashboard`: 1 прогрів + 5 прогонів
`-w "TTFB %{time_starttransfer}s, total %{time_total}s"`; розмір — `curl -s … | wc -c` (HTML) і
`curl -sL -H "RSC: 1" … | wc -c` (RSC); поля ліда в HTML — `grep -o '<поле>' | wc -l`; запити до БД —
приріст лічильників `db:…` у журналі `next start` після одного `curl`. «Було» — коміт `8bc9f78`
(код = `main`), кожне «Стало» — одразу після свого коміту.

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `a829fe1` | `app/dashboard/page.tsx` | `getLeads` (400 мс), `getLeadStats` (1200 мс), `getSourceBreakdown` (400 мс) — через `Promise.all` замість трьох послідовних `await` | TTFB 2.279 / 2.281 / 2.298 / 2.304 / 2.274 с (медіана **2.28 с**) | TTFB 1.511 / 1.502 / 1.468 / 1.452 / 1.475 с (медіана **1.48 с**) | `curl` TTFB, 5 прогонів |
| `server-serialization` | `08725c4` | `app/dashboard/page.tsx`, `components/leads-table.tsx` | у клієнтський `LeadsTable` передаються лише 5 полів (`LeadRow = Pick<Lead, "id" \| "fullName" \| "company" \| "status" \| "createdAt">`) замість усього `Lead` | HTML **424 592 Б**, RSC **315 197 Б**; `rawPayload`/`ipAddress`/`internalNotes` у HTML — по 172, `userAgent` — 344 | HTML **111 377 Б** (−74 %), RSC **31 257 Б** (−90 %); усі чотири поля — 0 | `curl … \| wc -c`, `grep -o … \| wc -l` |

Запити до БД на один запит сторінки не змінились (9: `getUserBySession` ×3, `getWorkspace` ×3,
`getLeads`, `getLeadStats`, `getSourceBreakdown`) — змінився лише порядок: після `async-parallel`
три запити сторінки стартують разом.

- Чому обрали для заміру `async-parallel`: найбільший внесок у скаргу клієнта («дашборд > 2 с»), ефект
  передбачуваний із `LATENCY_MS` у `lib/db.ts` (400 + 1200 + 400 → max = 1200 мс, очікувано −0,8 с) і
  видно одним `curl`. Отримали −0,80 с — збігається з розрахунком. Решта ~1,5 с — `getCurrentUser`
  і `getWorkspace` перед запитами (≈200 мс) і сам `getLeadStats` (1200 мс).
- `server-serialization` — навіщо: `LeadsTable` — Client Component, тож усе, що в його props,
  серіалізується в RSC Payload і HTML; таблиця використовує 5 полів із ~30, а в браузер ішли IP,
  user-agent, сирий payload форми й внутрішні нотатки (витік PII, не лише вага). Як переконались, що не
  зламали: `npm run lint` і `npm run build` (TypeScript перевіряє, що таблиця не читає інших полів:
  сортування й рядки використовують лише `fullName`, `company`, `status`, `createdAt`, `id`);
  `/dashboard` віддає сторінку з таблицею (111 КБ HTML).
  Сортування і перехід на сторінку ліда працюють

- Порада скіла, яку звірили з документацією Next.js 16 і **не** застосували або змінили — і чому:
  - `bundle-barrel-imports` для `import { debounce } from "lodash"` (`components/lead-search.tsx:5`) і
    `recharts` — у 16.3.5 не потрібна: `node_modules/next/dist/server/config.js:1117` за замовчуванням
    додає `modularizeImports: { lodash: { transform: "lodash/{{member}}" } }`, а `recharts` є в
    списку автоматичного `optimizePackageImports`
    (`docs/01-app/03-api-reference/05-config/01-next-config-js/optimizePackageImports.md`).
  - `server-cache-react` для `getWorkspace` — порада рев'ю правильна (`cache()` з inline-об'єктом
    `{ slug }` порівнює аргументи через `Object.is`, тож кеш не спрацьовує, і `getWorkspace` іде 3 рази),
    але в цій домашці не застосовано: досить двох виправлень.
  - `server-auth-actions` (`app/actions.ts:68, 74` — `updateLeadStatus` і `deleteLead` без перевірки
    сесії й воркспейсу) — найсерйозніша знахідка рев'ю, але це безпека, а не продуктивність, і
    патерн перевірки в дії описуємо в скілі Task B; окремим виправленням тут не робили.
  - `rendering-hydration-suppress-warning` для дат у `LeadsTable` — рев'ю саме пропонує не глушити
    попередження, а прибрати розбіжність (`timeZone`); погоджуємось, `suppressHydrationWarning` не
    застосовуємо.
- Якщо виміряне виправлення не змінило чисел — чому: змінило (див. таблицю).
- `npm run lint`, `npm run build` після виправлень: після кожного з двох комітів — без помилок і
  попереджень.

## Task B — `building-client-form`

Скіл — коміт `e6c6139`: `name: building-client-form` = тека; `description` 864 символи (≤ 1024);
`SKILL.md` 154 рядки; лише інструкції (без `scripts/`, `references/`); правила Vercel — за id
(`server-auth-actions`, `server-serialization`, `server-after-nonblocking`,
`rendering-usetransition-loading`).

- Запит у свіжій сесії Claude Code (VS Code, Opus 5.5; скіл не названо):
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове
  > поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.
- Чи спрацював скіл і як це видно: **так, з першої спроби** — першим кроком після запиту в журналі
  сесії виклик `building-client-form · skill` (інструмент `Skill`), ще до читання будь-яких файлів
  проєкту.
- Якщо не з першого разу: не знадобилось; `description` не змінювали.
- Що зроблено (коміт `8eb0a8a`):
  - `lib/note-form.ts` — `parseNoteForm`: серверна валідація (порожньо / > 500 символів; CRLF
    рахується як один символ, як у `maxLength`), повертає `errors` і `values`;
  - `app/actions.ts` — `addLeadNote`: сесія → `unauthorized`, лід з воркспейсу користувача →
    інакше `forbidden`, валідація, запис, `revalidatePath`; повертає лише `{ status, … }`;
  - `components/lead-note-form.tsx` — `useActionState`, `label htmlFor`, `aria-invalid`,
    `aria-describedby`, `role="alert"` для помилок, `role="status"` для успіху, `defaultValue` з
    `values`, `leadId` — прихованим полем;
  - `lib/data.ts` — `getSessionUser()` (повертає `null` замість редиректу, `getCurrentUser()` на ній);
    `lib/db.ts` — `appendLeadNote`; `app/dashboard/leads/[id]/page.tsx` — блок нотаток і форма.
- Пункти Verify зі скіла — результат кожного:
  - `npm run lint`, `npm run build` — без помилок (агент і повторно вручну після сесії). ✅
  - Порожня відправка — «Нотатку не збережено: виправте поле нижче.» у `<p role="alert">`, під полем
    «Напишіть текст нотатки»; у DevTools у `<textarea>` — `aria-invalid="true"`,
    `aria-describedby="note-text-hint note-text-error"`. Дія повернула
    `{"status":"invalid","errors":{"text":"Напишіть текст нотатки"},"values":{"text":""}}`. ✅
  - Понад 500 символів в обхід `maxLength` — помилка біля поля, текст лишається (за звітом агента,
    без JS на продакшн-збірці). ✅
  - Успішна відправка — «Нотатку додано.» (`role="status"`), нотатка з'явилась у «Внутрішні
    нотатки»; у журналі `db:appendLeadNote: 1`. ✅
  - Без JS — працює. ✅ Серверний HTML форми (як його бачить браузер без JS):
    `<form … action="" encType="multipart/form-data" method="POST">` зі службовими полями React
    (`$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1`, `$ACTION_KEY`) і `leadId`. Цю форму надіслано
    звичайним multipart POST без виконання JS (скрипт на Node `fetch`), і на `next start`, і на
    `next dev`:
    - порожня → `HTTP 200`, сторінка з `role="alert"` «Нотатку не збережено…» і `aria-invalid="true"`;
    - з текстом → `HTTP 200` за ~0,8 с, «Нотатку додано.», текст у «Внутрішні нотатки»,
      `db:appendLeadNote: 1`;
    - з cookie `bogus` → запису немає (після дії рендер сторінки через `getCurrentUser()` дає
      редирект на `/login`, `HTTP 307`).

    У браузері з DevTools «Disable JavaScript» спершу «не працювало»: вимкнення JS діє лише після
    **перезавантаження** сторінки — у вже гідрованому DOM форма має
    `action="javascript:throw new Error('A React form was unexpectedly submitted…')"`, яку React
    ставить на клієнті, і без JS така форма нічого не відправляє.
    <!-- TODO: якщо перевірите в браузері з перезавантаженням — допишіть результат. -->
  - Без сесії:
    - cookie **видалено** — `proxy.ts` перенаправив POST на `/login` (`POST /login 200 in 61ms`), у
      dev — «An unexpected response was received from the server»; **запису немає** (після цього в
      журналі жодного `db:appendLeadNote`). Дію цей сценарій не перевіряє: до неї запит не дійшов;
    - cookie **змінено** на `bogus` (DevTools → Application → Cookies) — перевірено в браузері:
      форма показала «Сесія завершилась. Увійдіть знову.», у журналі після
      `POST /dashboard/leads/lead_0023 200 in 202ms` лише `db:getUserBySession` — без `db:getWorkspace`,
      `db:getLead` і `db:appendLeadNote`, тобто дія зупинилась на першій перевірці. ✅
    - від користувача іншого воркспейсу й з підміненим `leadId` — нічого не записується (за звітом
      агента, без JS).
  - Журнал сервера — у коді дії лише `console.error("lead.note_add failed", { leadId, code })`, без
    тексту. Але `next dev` сам журналює аргументи Server Action (`└─ ƒ addLeadNote({…})`), і після
    помилки туди потрапляють `values`; у `next start` цього рядка немає. ⚠️ Не вимикали
    (`logging.serverFunctions: false` — налаштування всього проєкту).

**Що скіл виправив у собі після перевірки** (коміт `db83cd6`):

- порада `addNote.bind(null, leadId)` у Client Component з `useActionState` виявилась хибною: агент
  знайшов, що без JS POST зависає (нотатка записана, відповіді немає), і сам перейшов на приховане
  поле (`docs/01-app/02-guides/forms.md:126` таку альтернативу описує) — у скілі тепер приховане
  поле, `.bind()` лише в Server Component;
- пункт Verify «без сесії»: змінювати значення cookie, а не видаляти — інакше спрацьовує `proxy.ts`;
- журнал: `next dev` журналює аргументи Server Action — перевіряти на продакшн-збірці.

Рішення, які агент залишив людині (правило зупинки «неясно, хто має право»): хто може додавати
нотатки (зараз — будь-хто з воркспейсу ліда), формат нотатки (без автора й дати), аудит (не
пишеться, як і для зміни статусу/видалення). Для домашки лишили як є.

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал
мока й час відповіді форми — у `docs/ab-validation.md`.

- Що лишили в `SKILL.md`, а що винесли в `references/` (і чому): <…>
- Правила зупинки — перелік: <…>
- SHA коміту зі скілом (BASE для Task D): <…>
- Що скіл змінив у собі після прогонів (коміти й чому): <… або «нічого»>

**`check-contract.mjs` на коді `main`** (id + PASS/FAIL, код виходу):

```
<вивід>
```

**За бажанням: що скрипт побачив на навмисно поганому коді** (яку перевірку ламали, що вона
сказала). До рубрики це не входить, але бали знімає скрипт, який завжди PASS:

```
<вивід>
```

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL):

```
<вивід>
```

**Додатково (за бажанням):** матриця колбеків (`send-signed-callback.mjs`): випадок → очікуваний код → отриманий код.

## Task E3 (бонус) — ті самі скіли в Cursor

- Версія Cursor, модель: <…>
- Які скіли Cursor побачив: <…>
- Ті самі запити, що в Task B, і запит із `materials/ab-task.md`: спрацювали скіли чи ні: <…>
- Чим поведінка відрізнялась від Claude Code: <…>
