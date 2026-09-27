# Перевірка (Task A–C, бонус E3)

> Скопійовано в `docs/verification.md`. Сюди — лише те, що справді сталося: цитати,
> числа, імена файлів, SHA комітів. Порядок дій — у `docs/walkthrough.md`.
> Прогони A/B і фіча «запит на кошторис» — в окремому звіті `docs/ab-validation.md` (Task D).

- **Інструмент і версія, модель:** Cursor · Claude (Claude Code CLI під капотом)
- **ОС і термінал, Node:** Windows 11 · Git Bash · Node (перевірити версію: `node --version`)

## Скіли видно у свіжій сесії

- Як перевіряли: нова сесія в Cursor, запит «які skills тобі доступні? не відкривай файлів»

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project (`.claude/skills/`) | видно одразу після встановлення, коміт `4a238ee` |
| `building-client-form` | Project (`.claude/skills/`) | створено в Task B, коміт `dff9ec9`; спрацював у прогоні (виклик читання `SKILL.md`) |
| `integrating-n8n-webhooks` | Project (`.claude/skills/`) | створено в Task C; спрацювання перевіряється в Task D (прогін B) |

- Особисті скіли, які теж видно (`~/.claude/skills/`…), і чи можуть вони вплинути на перевірки: окремо `~/.claude/skills/` не перевірявся; список сесії показав лише вбудовані системні скіли Cursor/Claude Code (`dataviz`, `artifact-design`, `artifact-diagramming`, `artifact-capabilities`, `update-config`, `keybindings-help`, `code-review`, `simplify`, `fewer-permission-prompts`, `loop`, `schedule`, `claude-api`, `workflow-authoring`, `run`, `init`, `security-review`, `skill-creator`, `docs`, `docx`, `pdf`, `pptx`, `xlsx`, `google-workspace`, `import-memory`, `morning`) — вони не є проєктними й не мали б впливати на перевірки Task B/C/D.

## Task A — виправлення за скілом Vercel

Зроблено **3 виправлення** (мінімум 2, +1 бонусне для безпеки).

**Як міряли (для виправлень з числами):** продакшн-збірка (`npm run build && npm start`), cookie `leaddesk_session=demo-u_olena`, URL `http://localhost:3000/dashboard`. Один прогрів + 3 виміри `curl -w "TTFB %{time_starttransfer}s, total %{time_total}s\n"`. Для `server-cache-react` додатково — лічильники `db:<запит>` у консольному логі сервера (скільки разів виконався кожен запит на один рендер сторінки).

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `f1f92e7` | `app/dashboard/page.tsx` | `getLeads`, `getLeadStats`, `getSourceBreakdown` (400+1200+400 мс) виконувались послідовно → замінено на `Promise.all()` | TTFB ~2.32s (сер. з 3 прогонів: 2.328/2.325/2.304) | TTFB ~1.50s (сер.: 1.486/1.533/1.478) | curl TTFB, 3 прогони до/після на продакшн-збірці |
| `server-cache-react` | `cfd5f1e` | `lib/data.ts`, `app/dashboard/page.tsx`, `app/dashboard/layout.tsx`, `app/dashboard/leads/[id]/page.tsx`, `components/dashboard-header.tsx` | `getCurrentUser` не був обгорнутий у `cache()`; `getWorkspace` приймав об'єкт `{slug}`, через що `cache()` по `Object.is` ніколи не збігався → `getCurrentUser` обгорнуто в `cache()`, `getWorkspace` переведено на примітив `slug: string` | `db:getUserBySession`: 3× і `db:getWorkspace`: 3× за один рендер `/dashboard` | `db:getUserBySession`: 1× і `db:getWorkspace`: 1× за один рендер | лічильники в консольному логі `npm start` після одного `curl` на `/dashboard` |
| `server-auth-actions` | `74729da` | `app/actions.ts` | `updateLeadStatus`/`deleteLead` не перевіряли сесію й належність ліда воркспейсу — додано `assertLeadInUserWorkspace()`: `getCurrentUser()` + звірка `lead.workspaceId` з воркспейсом користувача; типізований результат `{status: "ok"\|"not_found"\|"forbidden"}` замість сирих помилок БД | (без заміру — правило про безпеку, не про швидкість) | (без заміру) | — |

- Чому обрали для заміру саме `async-parallel` і `server-cache-react`: ефект найпростіше й найоднозначніше виміряти числами (TTFB і лічильники запитів до "бази"), обидва напряму пояснювали початкову скаргу клієнта («дашборд відкривається понад 2 секунди») і знахідку з базової лінії (3× дублювання `getUserBySession`/`getWorkspace`).
- `server-auth-actions` — застосовано без заміру: це виправлення безпеки (CRITICAL за пріоритетом скіла), а не продуктивності; коректність перевірено через `npm run build` (типізація `LeadMutationState`) і те, що мутація тепер виконується лише після успішної перевірки прав.
- Порада скіла, яку звірили з документацією Next.js 16 і не застосували чи змінили: не було — усі три застосовані поради (`server-cache-react`, `async-parallel`, `server-auth-actions`) підтвердились як чинні для Next.js 16.3.5 (див. `docs/skill-review.md`, пункт 5), змінювати їх не довелось.
- Виміряні виправлення дали чіткий, відтворюваний ефект (TTFB −35%, лічильники БД 3×→1×) — падінь у "нуль ефекту" не було.
- `npm run lint`, `npm run build` після кожного з трьох виправлень: обидві команди проходили чисто (0 попереджень lint, успішна збірка) після кожного коміту.

## Task B — `building-client-form`

- Запит у свіжій сесії (скіл не названо):
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до 500 символів; нотатка дописується до внутрішніх нотаток ліда.
- Чи спрацював скіл і як це видно: **так**, спрацював з першого разу. У журналі сесії — пряме читання `.claude\skills\building-client-form\SKILL.md` (агент дав цю інструкцію дослідницькому субагенту і сам звірив реалізацію з чеклістом скіла: `label htmlFor`/`id`, `aria-invalid`, `aria-describedby`, `role="alert"`, повернення структурованого стану, `after()` для аудиту).
- Що зроблено (файли):
  - `lib/db.ts` — `appendLeadNote(id, note)`: дописує до `internalNotes` (рядок), оновлює `updatedAt`
  - `lib/lead-form.ts` — `parseLeadNoteForm` (валідація: непорожньо, ≤500 символів), `NOTE_MAX_LENGTH`
  - `app/actions.ts` — `addLeadNote`: той самий `assertLeadInUserWorkspace` (авторизація), валідація, `revalidatePath`, аудит-лог у `after()`
  - `components/add-note-form.tsx` (новий) — `useActionState`, доступні атрибути помилок, працює як звичайний `<form action>`
  - `app/dashboard/leads/[id]/page.tsx` — рендерить `<AddNoteForm>`
- Пункти Verify зі скіла — результат кожного:
  - `npm run lint` і `npm run build` — ✅ обидва без помилок
  - Порожня відправка форми → ✅ видима помилка «Введіть текст нотатки», введене (порожнє) не втрачається
  - Валідна відправка → ✅ нотатка додається одразу, зелене підтвердження «Нотатку додано»
  - Відправка з вимкненим JS у браузері → ⚠️ **частково**: сама мутація й валідація відпрацьовують коректно (POST доходить до сервера, дані зберігаються), але сторінка **не оновлюється сама** без ручного refresh — очікувана поведінка progressive enhancement форми без client-side навігації. Додатково виявлено: на **четвертому** послідовному виклику форми без JS аудит-лог у `after()` завис і не завершив HTTP-відповідь самостійно (клієнт "вічно" вантажив сторінку); дані фактично збереглись (видно з журналу сервера — `db:appendLeadNote: 4`), відповідь "розблокувалась" лише після наступного вхідного запиту (ручний F5). Перші три виклики відпрацювали нормально (`after()` завершився коректно, ~250мс на `insertAuditEntry`). Причина не діагностована до кінця в межах Task B — сама функція `logAudit`/`db.insertAuditEntry` не містить нічого підозрілого (проста затримка `sleep(250)` + push у масив); імовірно, особливість поведінки `after()` у self-hosted `next start` під послідовним навантаженням без клієнтського JS. Зафіксовано як відоме обмеження, не виправлялось у межах Task B.
  - Персональні дані в журналі сервера — ✅ у логах видно лише `db:appendLeadNote`, `db:insertAuditEntry` (лічильники за іменем запиту), текст нотатки й email/ім'я користувача в консоль не потрапляють

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал
мока й час відповіді форми — у `docs/ab-validation.md`.

- Що лишили в `SKILL.md`, а що винесли в `references/` (і чому): `SKILL.md` містить лише те, що агент має **зробити** — коротко: де живе код виклику, хто викликає, режим відповіді, порядок обробки колбеку (10 кроків, названі, але без повного тексту кожного), чекліст, правила зупинки, verify. Деталі й «чому» (повний текст 12 розділів записки команди) розкладено на 6 файлів `references/`: `outgoing-contract.md` (env, запит, заголовки, конверт, таймаут/повтори), `response-modes.md` (режими Webhook-вузла, тестовий/production URL), `callback-handling.md` (10 кроків обробки колбеку по порядку, ідемпотентність), `n8n-setup.md` (налаштування вузлів n8n словами), `logging-and-limits.md` (журнали, ліміти), `known-pitfalls.md` (розбіжності документація/код). З `SKILL.md` на кожен `references/`-файл — пряме посилання, один рівень, без ланцюжків.
- Правила зупинки — перелік:
  - незрозуміло, чи воркфлоу конкретної події швидкий чи довгий (вибір режиму відповіді)
  - немає контракту на нову подію (`event`, форма `data`)
  - потрібно тимчасово використати тестовий URL для налагодження
  - секрет (`N8N_WEBHOOK_TOKEN`/`N8N_CALLBACK_SECRET`) потрібно передати кудись поза серверним модулем
  - синхронне очікування довгого воркфлоу здається простішим рішенням «для MVP»
- SHA коміту зі скілом (BASE для Task D): c65cf9d
- Що скіл змінив у собі після прогонів (коміти й чому): ще не застосовувалось (Task D попереду)

**`check-contract.mjs` на коді `main`** (id + PASS/FAIL, код виходу):

C1 FAIL — тестовий URL n8n (/webhook-test/) не потрапляє в код чи .env.example
.env.example:6 N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook-test/lead-created
C2 PASS — жодна змінна N8N_* не має префіксу NEXT_PUBLIC_
C3 PASS — прямі виклики n8n-вебхука відсутні поза lib/n8n/client.ts
C4 FAIL — виклик n8n використовує AbortSignal.timeout
lib\n8n\client.ts:0 lib/n8n/client.ts не знайдено
C5 FAIL — колбек-роут читає сирий текст і звіряє підпис через timingSafeEqual
app\api\n8n[event]\route.ts:0 колбек-роут не знайдено

3 FAIL
exit=1


**Що скрипт побачив на навмисно поганому коді** (перевірка, що скрипт справді щось перевіряє, а не завжди PASS): у тимчасовій теці (`/tmp/bad-callback-test/app/api/n8n/[event]/route.ts`) з навмисним `req.json()` до перевірки підпису і `signature === "expected"` замість `timingSafeEqual`:

C1 PASS — тестовий URL n8n (/webhook-test/) не потрапляє в код чи .env.example
C2 PASS — жодна змінна N8N_* не має префіксу NEXT_PUBLIC_
C3 PASS — прямі виклики n8n-вебхука відсутні поза lib/n8n/client.ts
C4 FAIL — виклик n8n використовує AbortSignal.timeout
lib\n8n\client.ts:0 lib/n8n/client.ts не знайдено
C5 FAIL — колбек-роут читає сирий текст і звіряє підпис через timingSafeEqual
app\api\n8n[event]\route.ts:0 тіло не читається як сирий текст (.text())
app\api\n8n[event]\route.ts:0 підпис звіряється через === замість timingSafeEqual

3 FAIL
exit=1


C5 правильно спіймав обидва навмисно закладені порушення — перевірка справді працює, а не завжди PASS. Тестову теку видалено після перевірки.

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL): <буде заповнено в Task D>

**Додатково (за бажанням):** матриця колбеків (`send-signed-callback.mjs`) — не робилось (бонусний пункт).

## Task E3 (бонус) — ті самі скіли в Cursor

*(бонус, за бажанням, пізніше)*

- Версія Cursor, модель: <…>
- Які скіли Cursor побачив: <…>
- Ті самі запити, що в Task B, і запит із `materials/ab-task.md`: спрацювали скіли чи ні: <…>
- Чим поведінка відрізнялась від Claude Code: <…>