# Перевірка (Task A–C)

> Сюди — лише те, що справді сталося. Кожне число має файл-джерело в `docs/evidence/`. Прогони A/B і фіча —
> `docs/ab-validation.md`, тест спрацювання — `docs/trigger-evals.md`.
>
> **Як читати посилання на докази.** Щоб PR умістився в ліміт CodeRabbit, дрібні файли кожної задачі чи прогону
> зібрано в один `summary.md` тієї самої теки (`docs/evidence/bin/pack-evidence.mjs`). Файл, названий нижче
> (`00-baseline-main.txt`, `attack-after.txt`, `install.txt`…), — це розділ `summary.md` з таким самим
> заголовком, наприклад `` ## `task-a/attack-after.txt` ``. Оригінали 203 файлів і сирі транскрипти —
> `docs/evidence/raw-evidence.tar.gz`: 167 з першого пакування і 36 з другої пари A/B (`task-d/pair2`,
> `run-a3`, `run-b3`). Розділи, дописані в `summary.md` пізніше (після рев'ю CodeRabbit, аудиту й код-рев'ю), в архів
> не входять: їхній текст у `summary.md` — це і є оригінал.
>
> **Хеші комітів.** Звіти посилаються на поточні хеші. Докази, записані до переписування історії, містять старі
> хеші: усе в `summary.md`, транскриптах і архіві, крім розділів «після аудиту», «після код-рев'ю» й пари A3/B3. Відповідність
> старий → новий — у розділі «Переписана історія».

## Усі змінені файли гілки

<!-- changed-files:start -->
Згенеровано `node docs/evidence/bin/changed-files.mjs --write` з `git diff --name-status --no-renames main...HEAD`; `--check` падає, якщо таблиця розійшлась із діфом. **Усього 158 файлів**: код застосунку й `.env.example` — 19, вендорений скіл Vercel — 75, власні скіли — 10, документи й докази — 53, інше — 1 (`skills-lock.json`). Поза цим списком гілка не змінює нічого: `tools/`, `materials/`, `.github/`, `.coderabbit.yaml`, `package.json`, `package-lock.json` — без змін.

| Файл | Статус | Task | Коміти | Що змінено |
|---|---|---|---|---|
| `.claude/skills/building-client-form/SKILL.md` | додано | B | `d4a9ca7` `9297071` | скіл лише з інструкцій; v0.1.1 — приховане поле замість `bind` |
| `.claude/skills/integrating-n8n-webhooks/SKILL.md` | додано | C | `8c6fbeb` `eab812c` `825fec0` `c3545ea` `8ce4d38` | скіл n8n: опис, правила зупинки, чеклист; пізніші коміти змінюють лише рядок `version` (0.1.1, 0.1.2, 0.1.3, 0.1.4) |
| `.claude/skills/integrating-n8n-webhooks/references/code-templates.md` | додано | C | `8c6fbeb` `825fec0` `c3545ea` `8ce4d38` | шаблони коду; v0.1.2 — `safeDocumentUrl` (рев'ю CodeRabbit); v0.1.3 — статус одним записом, строгий бюджет, `event` ↔ `status` (аудит); v0.1.4 — `ready` кінцевий, ключі колбеків добу (код-рев'ю) |
| `.claude/skills/integrating-n8n-webhooks/references/contract.md` | додано | C | `8c6fbeb` `c3545ea` | повний контракт; v0.1.3 — крок 7: `event` ↔ `data.status` (аудит) |
| `.claude/skills/integrating-n8n-webhooks/references/n8n-setup.md` | додано | C | `8c6fbeb` | файл скіла n8n, без змін після першого коміту скіла |
| `.claude/skills/integrating-n8n-webhooks/references/response-modes.md` | додано | C | `8c6fbeb` | файл скіла n8n, без змін після першого коміту скіла |
| `.claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` | додано | C | `8c6fbeb` `eab812c` `825fec0` | перевірки C1–C15 і їхній selftest; v0.1.1 — C10/C14 після Task D; v0.1.2 — C12 після рев'ю CodeRabbit |
| `.claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs` | додано | C | `8c6fbeb` | файл скіла n8n, без змін після першого коміту скіла |
| `.claude/skills/integrating-n8n-webhooks/scripts/selftest-check-contract.mjs` | додано | C | `8c6fbeb` `eab812c` `825fec0` | перевірки C1–C15 і їхній selftest; v0.1.1 — C10/C14 після Task D; v0.1.2 — C12 після рев'ю CodeRabbit |
| `.claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs` | додано | C | `8c6fbeb` | файл скіла n8n, без змін після першого коміту скіла |
| `.claude/skills/vercel-react-best-practices/AGENTS.md` | додано | A | `3c354e2` | скіл Vercel, вендорено без змін (`skills@1.7.0 --copy`, тег `agent-skills-063bee94…`) |
| `.claude/skills/vercel-react-best-practices/README.md` | додано | A | `3c354e2` | скіл Vercel, вендорено без змін (`skills@1.7.0 --copy`, тег `agent-skills-063bee94…`) |
| `.claude/skills/vercel-react-best-practices/SKILL.md` | додано | A | `3c354e2` | скіл Vercel, вендорено без змін (`skills@1.7.0 --copy`, тег `agent-skills-063bee94…`) |
| `.claude/skills/vercel-react-best-practices/rules/*.md` (72 файли) | додано | A | `3c354e2` | правило скіла Vercel, вендорено без змін (72 файли разом) |
| `.env.example` | змінено | D | `c94da6f` `6832770` | 4 ключі контракту з прогону B1; прибрано `N8N_WEBHOOK_URL` з `/webhook-test/` |
| `app/actions.ts` | змінено | A, D | `01464c9` `05aecc2` `a362951` | A: `authorizeLead` у `updateLeadStatus`/`deleteLead` (`server-auth-actions`); D: `submitLead` → `triggerWorkflow("lead-created")` в `after()`, при невдачі — аудит `lead.n8n_failed` (рев'ю CodeRabbit) |
| `app/api/n8n/[event]/route.ts` | додано | D | `c94da6f` `400a450` `bcb9c05` | прогін B1: колбек-роут з HMAC, вікном 300 с, ідемпотентністю; після аудиту — суфікс `event` має збігатися з `data.status`; після код-рев'ю — `ready` кінцевий |
| `app/dashboard/layout.tsx` | змінено | A | `e84f206` | `server-cache-react`: `getWorkspace(user.workspaceSlug)` замість `{ slug }` |
| `app/dashboard/leads/[id]/page.tsx` | змінено | A | `e84f206` | `server-cache-react`: `getWorkspace(user.workspaceSlug)` замість `{ slug }` |
| `app/dashboard/page.tsx` | змінено | A | `e289c5d` `e84f206` `281ff34` `3d3cf84` `01c9f39` | `async-parallel`, `server-serialization` (`LeadRow`), `server-cache-react` (`getWorkspace(slug)`), `async-suspense-boundaries`; після код-рев'ю — відмова `statsPromise` позначена обробленою |
| `app/quotes/[id]/page.tsx` | додано | D | `c94da6f` | прогін B1: сторінка статусу запиту |
| `app/quotes/actions.ts` | додано | D | `c94da6f` `568ccac` `45f20f5` | прогін B1: Server Action `requestQuote`, n8n в `after()`; після аудиту — `sent`/`failed` лише з `queued` одним записом; після код-рев'ю — назва помилки в журналі |
| `app/quotes/new/page.tsx` | додано | D | `c94da6f` | прогін B1: сторінка форми кошторису |
| `components/auto-refresh.tsx` | додано | D | `c94da6f` `8dc7c03` | прогін B1: `router.refresh()` кожні 5 с; після рев'ю CodeRabbit — не більше 60 разів |
| `components/dashboard-header.tsx` | змінено | A | `e84f206` | `server-cache-react`: `getWorkspace(user.workspaceSlug)` замість `{ slug }` |
| `components/leads-table.tsx` | змінено | A | `281ff34` | `server-serialization`: тип `LeadRow` (5 полів) замість `Lead` |
| `components/leads-toolbar.tsx` | змінено | A | `211f8fe` `7a55dd8` | `bundle-conditional` (`import("exceljs")` у кліку), `bundle-dynamic-imports` (`SourcesChart` через `next/dynamic`) |
| `components/quote-form.tsx` | додано | D | `c94da6f` `8dc7c03` `9d056af` | прогін B1: форма з `useActionState`; після рев'ю CodeRabbit — `aria-invalid`, `aria-describedby`, `role="alert"`; після аудиту — `inputMode="decimal"` |
| `docs/ab-validation.md` | додано | D | `266f9d1` `eab812c` `bd6ae06` `2f61e6a` `4c083f3` `103cf57` `3b22311` `fbf35b7` `4b3ea7e` `fe8ffb9` | звіт A/B: перша пара (A1/A2, B1/B2), друга пара A3/B3, перенесення прогону B1, дефекти з аудиту |
| `docs/ab/a-without-skill-run2.diff` | додано | D | `8cf9d4a` `88b2e8b` | повний діф прогону агента від тегу `base` копії |
| `docs/ab/a-without-skill-run3.diff` | додано | D | `fbf35b7` | повний діф прогону агента від тегу `base` копії |
| `docs/ab/a-without-skill.diff` | додано | D | `8cf9d4a` `88b2e8b` | повний діф прогону агента від тегу `base` копії |
| `docs/ab/b-with-skill-run2.diff` | додано | D | `8cf9d4a` `88b2e8b` | повний діф прогону агента від тегу `base` копії |
| `docs/ab/b-with-skill-run3.diff` | додано | D | `fbf35b7` | повний діф прогону агента від тегу `base` копії |
| `docs/ab/b-with-skill.diff` | додано | D | `8cf9d4a` `88b2e8b` | повний діф прогону агента від тегу `base` копії |
| `docs/evidence/bin/changed-files.mjs` | додано | A–E | `2f61e6a` `0923e70` `103cf57` `3b22311` `fbf35b7` `4b3ea7e` `af2c1ae` `fe8ffb9` | обв'язка сесій і вимірів, пакування доказів |
| `docs/evidence/bin/pack-evidence.mjs` | додано | A–E | `bd6ae06` `0923e70` | обв'язка сесій і вимірів, пакування доказів |
| `docs/evidence/bin/run-ab-session.sh` | додано | A–E | `8cf9d4a` `4322f03` | обв'язка сесій і вимірів, пакування доказів |
| `docs/evidence/bin/run-readonly-session.sh` | додано | A–E | `913f992` | обв'язка сесій і вимірів, пакування доказів |
| `docs/evidence/bin/run-scoped-session.sh` | додано | A–E | `50ed3d1` | обв'язка сесій і вимірів, пакування доказів |
| `docs/evidence/bin/server.sh` | додано | A–E | `50ed3d1` `0923e70` | обв'язка сесій і вимірів, пакування доказів |
| `docs/evidence/bin/session-report.mjs` | додано | A–E | `913f992` `50ed3d1` | обв'язка сесій і вимірів, пакування доказів |
| `docs/evidence/raw-evidence.tar.gz` | додано | A–E | `bd6ae06` `fbf35b7` | оригінали 203 файлів доказів: 167 першого пакування, 36 пари A3/B3 |
| `docs/evidence/task-a/attack-server-actions.sh` | додано | A | `01464c9` `50ed3d1` `0923e70` | докази Task A |
| `docs/evidence/task-a/measure-dashboard.sh` | додано | A | `e289c5d` `50ed3d1` | докази Task A |
| `docs/evidence/task-a/summary.md` | додано | A | `bd6ae06` `0923e70` | докази Task A |
| `docs/evidence/task-a/vercel-review/transcript.md` | додано | A | `77882b5` | докази Task A |
| `docs/evidence/task-b/nojs-isolation.sh` | додано | B | `9297071` `0923e70` | докази Task B |
| `docs/evidence/task-b/run-1/transcript.md` | додано | B | `9297071` | докази Task B |
| `docs/evidence/task-b/run-2/transcript.md` | додано | B | `4a0d34b` | докази Task B |
| `docs/evidence/task-b/summary.md` | додано | B | `bd6ae06` `0923e70` `4b3ea7e` | докази Task B |
| `docs/evidence/task-b/verify-note-form.sh` | додано | B | `9297071` `4a0d34b` `0923e70` | докази Task B |
| `docs/evidence/task-c/bad-callback.txt` | додано | C | `2f4fa4f` | докази Task C |
| `docs/evidence/task-c/check-contract-main.txt` | додано | C | `2f4fa4f` | докази Task C |
| `docs/evidence/task-c/selftest.txt` | додано | C | `2f4fa4f` `eab812c` | докази Task C |
| `docs/evidence/task-d/audit-regress.mjs` | додано | D | `3b22311` `af2c1ae` | докази Task D |
| `docs/evidence/task-d/audit-regress.sh` | додано | D | `3b22311` `4322f03` | докази Task D |
| `docs/evidence/task-d/branch/summary.md` | додано | D | `bd6ae06` `0923e70` `3b22311` `fe8ffb9` | докази Task D |
| `docs/evidence/task-d/lead-check.sh` | додано | D | `266f9d1` | докази Task D |
| `docs/evidence/task-d/pair2/summary.md` | додано | D | `fbf35b7` | докази Task D |
| `docs/evidence/task-d/probe/summary.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/probe/transcript.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-a1/summary.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-a1/transcript.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-a2/summary.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-a2/transcript.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-a3/summary.md` | додано | D | `fbf35b7` | докази Task D |
| `docs/evidence/task-d/run-a3/transcript.md` | додано | D | `fbf35b7` | докази Task D |
| `docs/evidence/task-d/run-b1/summary.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-b1/transcript.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-b2/summary.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-b2/transcript.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-d/run-b3/summary.md` | додано | D | `fbf35b7` | докази Task D |
| `docs/evidence/task-d/run-b3/transcript.md` | додано | D | `fbf35b7` | докази Task D |
| `docs/evidence/task-d/scenario.sh` | додано | D | `8cf9d4a` | докази Task D |
| `docs/evidence/task-d/summary.md` | додано | D | `bd6ae06` | докази Task D |
| `docs/evidence/task-e/summary.md` | додано | E2 | `bd6ae06` | докази Task E2 |
| `docs/n8n-integrations.md` | додано | D | `c94da6f` `05aecc2` `a362951` `3b22311` `fe8ffb9` | реєстр інтеграцій: `quote-request` (прогін B1; формат `budget`, звірка `event` ↔ `status`, `ready` кінцевий), `lead-created` (доведення, `lead.n8n_failed`) |
| `docs/skill-review.md` | додано | A | `eaf292a` `3c354e2` `77882b5` `bd6ae06` `2f61e6a` `103cf57` `4b3ea7e` | рев'ю скіла Vercel до встановлення (історія правок — у шапці файлу) |
| `docs/trigger-evals.md` | додано | E2 | `32e3177` `2f61e6a` `103cf57` `4b3ea7e` | тест спрацювання n8n-скіла, 12 запитів |
| `docs/verification.md` | додано | A–C | `git log main..HEAD -- docs/verification.md` | звіт перевірки Task A–C, ця таблиця, розділи «Після рев'ю CodeRabbit», «Переписана історія», «Після аудиту», «Після код-рев'ю» |
| `lib/data.ts` | змінено | A | `e84f206` | `server-cache-react`: `getCurrentUser` і `getWorkspace(slug: string)` у `cache()` |
| `lib/db.ts` | змінено | D | `c94da6f` `568ccac` `bcb9c05` | прогін B1: сховище запитів і застовплених ключів колбеків; після аудиту — `updateQuote(…, ifStatus)`; після код-рев'ю — `ifStatus` списком, ключі колбеків живуть добу |
| `lib/n8n/client.ts` | додано | D | `c94da6f` `45f20f5` | прогін B1: єдиний модуль, що говорить з n8n; після код-рев'ю — `N8nConfigError` |
| `lib/quote-form.ts` | додано | D | `c94da6f` `9d056af` `01f2951` | прогін B1: розбір і валідація форми кошторису; після аудиту — бюджет з десятковими, без видалення ком; після код-рев'ю — задовгий бюджет — помилка |
| `lib/types.ts` | змінено | D | `c94da6f` | прогін B1: типи `Quote`, `QuoteStatus` |
| `skills-lock.json` | додано | A | `3c354e2` | закріплення версії скіла Vercel: `ref` + `computedHash` |
<!-- changed-files:end -->

- **Інструмент і версія, модель:** Claude Code 2.1.282 · `claude-opus-5-5` (`--model opus`), effort `high`
  — з поля `model` в `init` кожного транскрипту
- **ОС і термінал, Node:** macOS (Darwin 25.6) · zsh · Node 22.21.0 · npm 10.9.4

**Як запускались перевірочні сесії.** Кожна — нова headless-сесія
`docs/evidence/bin/run-readonly-session.sh`: `claude -p` з запитом із файлу (SHA256 у `meta.txt`),
`--setting-sources project --strict-mcp-config` (без особистих скілів, хуків і MCP),
`--allowedTools Skill,Read,Grep,Glob --disallowedTools Edit,Write,NotebookEdit,Bash`. Факти про те,
що агент бачив, викликав і читав, витягує з транскрипту `docs/evidence/bin/session-report.mjs`,
а не пам'ять.

> **Чому лише для читання.** Спочатку я збирав скрипт на `--permission-mode bypassPermissions`, але
> класифікатор auto mode його заблокував («Create Unsafe Agents»). Обходити блокування не став і
> перейшов на сесії лише для читання з забороненими `Edit`/`Write`/`Bash`. Для рев'ю (Task A) і
> тесту спрацювання (Task B, E2) цього достатньо: ознака спрацювання — виклик `Skill`, а не зміни у файлах.

## Скіли видно у свіжій сесії

- Як перевіряли: `claude -p "/context"` з кореня репозиторію, двічі: зі звичайними налаштуваннями
  (`context-after-install.txt`) і з `--setting-sources project --strict-mcp-config`
  (`context-project-only.txt`). Обидва — розділи `docs/evidence/task-a/summary.md`.

| Skill | Звідки | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | видно в обох режимах, ~120 токенів опису |
| `building-client-form` | Project | див. Task B |
| `integrating-n8n-webhooks` | Project | див. Task C |

- **Особисті скіли, які теж видно.** У звичайній сесії поруч із проєктними — **14 скілів `User`** з
  `~/.claude/skills/` (`design`, `security-and-hardening`, `interface-design`…), 9 `claude.ai sync` і
  плагін `drawio`. Вони можуть вплинути: `security-and-hardening` чи `interface-design` спрацювали б на
  той самий запит про форму, що й `building-client-form`. Тому **всі перевірочні сесії й прогони A/B —
  з `--setting-sources project`**: у цьому режимі `/context` показує лише `Project` і `Built-in`,
  жодного `User`. Глобальний `~/.claude/CLAUDE.md` (RTK, semble) вантажиться завжди, в усіх сесіях однаково.

## Task A — виправлення за скілом Vercel

**Рев'ю за скілом.** Свіжа сесія, запит із walkthrough дослівно (`docs/evidence/task-a/vercel-review/`).
Агент викликав `Skill` → `vercel-react-best-practices`, прочитав 28 шляхів: 24 файли з `app/`, `components/`, `lib/`, а також `next.config.ts`,
`rules/server-cache-react.md`, `node_modules/next/dist/server/config.js` і `Glob` по `node_modules/next/dist/docs`, за межі репозиторію не
виходив, файлів не змінював, $0,81. Результат — таблиця з 16 знахідок з id правил (`transcript.md`, «Final answer»).

**Як міряли.** `docs/evidence/task-a/measure-dashboard.sh <мітка>` — один і той самий скрипт для кожного
заміру: `npm run build` → `next start -p 3000` → прогрів → 3 × `curl` з cookie
`leaddesk_session=demo-u_olena` (TTFB і total) → лічильники `db:<запит>` з журналу сервера за **один**
запит сторінки → розмір HTML і RSC → входження полів ліда в HTML → сума JS-скриптів, які HTML сторінки
вантажить при відкритті (сирий розмір і gzip). Виводи `00-baseline-main.txt` … `07-async-suspense-boundaries.txt` —
розділи `docs/evidence/task-a/summary.md`; у першому рядку кожного — SHA, `BUILD_ID` збірки й PID сервера.

> **Заміри знято двічі — і ось чому.** Перша серія йшла в робочому дереві: скрипт стартував
> `npx next start` і зупиняв його `kill` обгортки `npx`. Пізніше (Task B) з'ясувалось, що `next start`
> перейменовує процес на `next-server`, і сервер може пережити зупинку: наступний скрипт тоді впаде на
> зайнятому порту й виміряє **старий** сервер — саме так зіпсувався перший verify Task B. Тому вся серія
> Task A перезнята в окремому worktree поза репозиторієм (`git checkout` кожного SHA по черзі) скриптом,
> який перед стартом падає, якщо порт 3000 зайнятий, і перевіряє, що порт слухає саме його процес
> (`docs/evidence/bin/server.sh`). У таблиці — друга серія. Розбіжність із першою: усі розміри,
> лічильники й кількість скриптів **ідентичні**, час — у межах 15 мс (напр. базова лінія 2,244 → 2,219 с).
> Висновок про `lodash` (нижче) підтверджено на сервері з перевіреним власником.

| Правило (id) | Коміт | Файли | Що змінилось | Було | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `e289c5d` | `app/dashboard/page.tsx` | `getLeads`/`getLeadStats`/`getSourceBreakdown` — `Promise.all` замість трьох `await` підряд | TTFB **2,219 / 2,220 / 2,217 с** | TTFB **1,416 / 1,419 / 1,413 с** | `curl`, 3 прогони, `00-*` → `01-*` |
| `server-cache-react` | `e84f206` | `lib/data.ts`; виклики `getWorkspace(user.workspaceSlug)` у `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/leads/[id]/page.tsx`, `components/dashboard-header.tsx` | `getCurrentUser` обгорнуто в `cache()`; `getWorkspace(slug)` приймає рядок, а не інлайн `{ slug }` (з об'єктом `cache` щоразу промахувався) | `db:getUserBySession` **3**, `db:getWorkspace` **3** на запит | **1** і **1** | лічильники `db:*` за один запит, `01-*` → `02-*` |
| `server-serialization` | `281ff34` | `app/dashboard/page.tsx`, `components/leads-table.tsx` | у `LeadsTable` — `LeadRow` (5 полів), а не весь `Lead` | HTML **424 592 Б**, RSC **315 197 Б**; `rawPayload`, `internalNotes`, `ipAddress` — по **172** входження в HTML | HTML **111 377 Б**, RSC **31 257 Б**; **0** входжень | `curl … \| wc -c`, `grep -o <поле>`, `02-*` → `03-*` |
| `bundle-conditional` | `211f8fe` | `components/leads-toolbar.tsx` | `exceljs` — `await import("exceljs")` усередині обробника кліку | JS на відкритті **1 871 692 Б** (gzip 536 006) | **941 001 Б** (gzip 282 121) | сума скриптів з HTML, `03-*` → `04-*` |
| `bundle-dynamic-imports` | `7a55dd8` | `components/leads-toolbar.tsx` | `SourcesChart` (recharts) — `next/dynamic` з `ssr: false` у Client Component | **941 001 Б**, 10 скриптів | **587 212 Б** (gzip 181 271), 9 скриптів | те саме, `04-*` → `05-*` |
| `server-auth-actions` | `01464c9` | `app/actions.ts` | `updateLeadStatus` / `deleteLead`: сесія, належність ліда до workspace користувача, статус із `LEAD_STATUSES` — **усередині** дії | від імені `u_marta` (інший workspace) `updateLeadStatus(lead_0001)` → **HTTP 200, статус змінився** | **HTTP 500, статус не змінився** | прямий POST з `Next-Action`, `attack-before.txt` → `attack-after.txt` |
| `async-suspense-boundaries` | `3d3cf84` | `app/dashboard/page.tsx` | запит статистики стартує одразу, картки стрімляться за `<Suspense>` зі скелетоном | TTFB **1,412 с** | TTFB **0,612 / 0,613 / 0,610 с**; total 1,407 с | `curl`, 3 прогони, `05-*` → `07-*` |

**Разом по дашборду:** TTFB 2,22 → **0,61 с**, повна сторінка 2,22 → **1,41 с**, HTML 425 → 113 КБ (113 238 Б після
Suspense; 111 377 Б одразу після `server-serialization`),
JS на відкритті 1,87 МБ → **0,59 МБ** (gzip 536 → 181 КБ), жодного поля `rawPayload`/`internalNotes`/`ipAddress`
у браузері, запити сесії 3 → 1.

- **Чому для «головного» заміру — `async-parallel`.** Скарга клієнта — «дашборд відкривається понад
  2 секунди»; базова лінія це підтвердила (2,22 с), а ефект читається одним числом. Числа зняті для всіх
  виправлень, бо скрипт однаковий.
- **Виправлення без зміни часу — теж результат.** `server-cache-react` не прискорив сторінку (1,416 →
  1,416 с): три виклики з layout, header і page і так ішли паралельно. Він прибирає 4 зайві запити до БД на
  кожне відкриття — це навантаження на базу, а не латентність.
- **Як переконались, що не зламали.** Після кожного виправлення — `npm run lint` і `tsc --noEmit` (0
  помилок), замір на продакшн-збірці. Після всіх — прогін у браузері (`docs/evidence/task-a/summary.md`):
  5 карток і 172 рядки на місці; графік довантажує окремий чанк лише після кліку (скриптів 9 → 10) і
  малює 6 стовпців; експорт довантажує чанк `exceljs` лише після кліку (10 → 11) і створює
  `leads-2026-09-27.xlsx` на 18 704 Б; помилок у консолі немає.
- **Атака на `server-auth-actions`: що саме було діркою.** Без сесії старий код теж не змінив лід, але не
  завдяки дії: `/dashboard/*` прикриває `proxy.ts` (307 на `/login`), а POST на публічні `/` і `/login`
  отримує кешований `{}` — у маніфесті дія зареєстрована лише для `app/dashboard/leads/[id]/page`.
  Справжня дірка — **авторизація**: будь-який залогінений користувач міняв ліди чужого workspace. Саме це
  і закрито.

**Порада скіла, яку звірили з Next.js 16 і не застосували або змінили:**

| Порада | Що зробили | Чому |
|---|---|---|
| `bundle-barrel-imports` для `lodash` | застосував (`035118b`, `components/lead-search.tsx`), **відкотив** (`e8c2cb5`); у підсумковому діфі гілки цього файлу немає | JS до і після — **587 212 Б байт у байт** (`05-*` / `06-*`). Next.js 16 уже переписує `import { debounce } from "lodash"` на `lodash/debounce` вбудованим `modularizeImports` (`node_modules/next/dist/server/config.js:1117`). Помилились і рев'ю-агент (знахідка 8), і перша редакція `docs/skill-review.md` — обидва дивились лише на `optimizePackageImports`. Виправлено в рев'ю, п. 5 |
| `bundle-dynamic-imports` з `ssr: false` | застосував **лише** в Client Component (`leads-toolbar.tsx` має `"use client"`) | `lazy-loading.md:94`: у Server Component `ssr: false` — помилка збірки |
| `server-after-nonblocking` для `submitLead` (знахідка 6) | **відкладено до Task D** | це виклик n8n; walkthrough вимагає привести його до контракту разом із фічею, а не до BASE — інакше прогін A отримає частину контракту задарма |
| `client-swr-dedup`, `rerender-*`, `js-*` (знахідки 11–16) | не застосовано | дрібні або без вимірного ефекту на наших ~170 рядках; `client-swr-dedup` — нова залежність (`swr`), а `AGENTS.md` вимагає «так» на кожен пакет |

- `npm run lint`, `npm run build` після виправлень: 0 проблем ESLint, збірка успішна (кожен замір починається з `npm run build`).

## Task B — `building-client-form`

- Запит у свіжій сесії (скіл не названо; дослівно з walkthrough, SHA256 `1fb304ac…` однаковий в обох спробах):
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле
  > до 500 символів; нотатка дописується до внутрішніх нотаток ліда.
- Сесія: `docs/evidence/bin/run-scoped-session.sh` — `acceptEdits`, allowlist `Skill, Read, Grep, Glob,
  Edit, Write, Bash(npm run lint|build), Bash(npx tsc --noEmit), Bash(git status*|diff*)`,
  `--permission-prompts none`, мережеві інструменти заборонені, `--setting-sources project`.

| Спроба | Скіл | Чи спрацював і як видно | Що зробив агент | Verify |
|---|---|---|---|---|
| **run-1** (`d4a9ca7`, скіл 0.1.0) | у сесії: `building-client-form`, `vercel-react-best-practices` + вбудовані | **так, першим же кроком**: у транскрипті інструмент `Skill` → `building-client-form` (крок 1 із 25), ще до читання коду | `lib/lead-note-form.ts` (розбір, 500 символів, відмова замість обрізання), `components/lead-note-form.tsx` (`useActionState`, `aria-*`, `role="alert"`, `values` → `defaultValue`), дія `addLeadNote` (сесія → `authorizeLead` з Task A → валідація → запис → `after(logAudit)` → `{ status }`), `db.appendLeadNote` | **не пройшов** пункт «без JS»: форма зависала. Причина — у скілі (див. нижче) |
| **run-2** (`9297071`, скіл 0.1.1) | те саме | **так**: `Skill` → `building-client-form` першим кроком (1 із 27) | те саме, але id ліда — приховане поле, а не `.bind`; плюс нормалізація `\r\n` (браузерний `maxLength` рахує перенос за 1 символ, а надсилає 2) | **усі пункти пройшли** (нижче) |

**Що знайшла перша спроба — і що змінено в скілі.** Агент виконав скіл дослівно:
`useActionState(addLeadNote.bind(null, leadId))`, бо версія 0.1.0 радила «додаткові аргументи —
`action.bind(null, id)`». Відправка такої форми **без JavaScript** на сторінці ліда зависає: дія
виконується (`db:appendLeadNote` є в журналі сервера), але відповідь не починається навіть за 40 с. Так
само поводився справжній браузер: нативний `HTMLFormElement.submit()` серверної форми повис на навігації.
Ізоляція в окремому worktree (`docs/evidence/task-b/summary.md`):

| Варіант | Результат без JS |
|---|---|
| код run-1 (`useActionState(action.bind(null, leadId))`) | HTTP 000, 10 с без заголовків |
| той самий, дія повертає `invalid` першим рядком | HTTP 000, 10 с — тобто справа не в тілі дії |
| незв'язана дія + `<input type="hidden" name="leadId">` | **HTTP 200 за 0,52 с** |
| контроль: наявна форма заявки на `/`, та сама емуляція | HTTP 200 за 0,04 с, з помилками полів |

Документація Next.js 16 каже протилежне (`02-guides/forms.md:127`: «`bind` … supports progressive
enhancement»). У зв'язці з `useActionState` на цьому динамічному маршруті це не так. Скіл виправлено
(`9297071`, v0.1.1): id запису — приховане поле з авторизацією в дії; `bind` з `useActionState` не
використовувати. Захисту `bind` однаково не дає: агент сам написав у run-1, що «the id is still
client-controlled, so check it here». Діфи обох спроб — розділи `task-b/run-1/agent.diff` і `task-b/run-2/agent.diff`
у `docs/evidence/task-b/summary.md`.

**Пункти Verify зі скіла — run-2** (`docs/evidence/task-b/summary.md`, скрипт `verify-note-form.sh`;
«без JS» — це серверна `<form>` з її прихованими полями `$ACTION_*` і `leadId`, надіслана як multipart без
заголовка `Next-Action`, тобто так, як її надсилає браузер без JavaScript):

| Пункт Verify | Результат |
|---|---|
| `npm run lint`, `npm run build` | 0 проблем; збірка успішна (verify-скрипт починається з `npm run build`) |
| порожня відправка | HTTP 200; `aria-invalid="true"`, `role="alert"`, «Напишіть текст нотатки» — у відповіді |
| 501 символ | помилка «Не більше 500 символів»; **введений текст лишився** в `<textarea>`; нічого не збережено |
| відправка без JS, власник | HTTP 200, нотатка на сторінці |
| дія від імені користувача іншого workspace (`u_marta`) | HTTP 404, нотатки немає |
| дія без сесії | HTTP 307 на `/login`, нотатки немає |
| журнал сервера | 0 рядків з текстом нотатки, `@` чи `+380` (з 57 рядків — лише лічильники `db:*`) |
| з JavaScript, у браузері (розділ `task-b/run-2/verify-browser.txt`) | порожня: `aria-invalid`, `aria-describedby="lead-note-error"`, підсумок `role="alert"`; валідна: нотатка на сторінці, `role="status"` «Нотатку додано.» |

**Код з перевірки в гілці не лишив** — свідомо, хоча run-2 пройшов Verify. Від Task B у діфі гілки є лише
`.claude/skills/building-client-form/SKILL.md` (див. таблицю вгорі); `lib/lead-note-form.ts`, `components/lead-note-form.tsx`
і дія `addLeadNote` існували тільки в робочому дереві під час перевірки. У ньому є
`after(() => logAudit(…))` у Server Action, тобто робочий приклад правила `server-after-nonblocking`.
Потрапивши в BASE для Task D, він дав би агенту в прогоні A частину контракту n8n безкоштовно (walkthrough,
Task D, крок 1: «BASE узято запізно»). Обидва діфи збережено як доказ.

> **Перший verify був недійсним — і це моя помилка, а не агента.** Скрипт стартував `next start`, але порт
> 3000 тримав мій старий `next-server` зі збірки ще без форми нотатки: `pkill -f "next start"` його не
> вбив, бо процес перейменовується. Скрипт не помітив, що його сервер не піднявся, і отримав 500 від
> старого. Файл лишено як є з позначкою: розділ `task-b/run-1/verify-invalid-stale-server.txt` у `docs/evidence/task-b/summary.md`. Після цього всі
> скрипти стартують сервер через `docs/evidence/bin/server.sh`: він падає, якщо порт зайнятий, і
> перевіряє PID власника. Через це й перезнята вся серія Task A.

**Що ще видно з транскриптів про межі сесії.** `Bash` поза allowlist усе ж виконувався, якщо команда лише
читає: пройшли `git ls-files … | head`, `grep …`, `sed -n 1,80p …`, `find app/dashboard`,
`ls node_modules/next/dist/docs/`, `git diff | grep …`. Відхилено («no approval surface») кожну зв'язку,
де була хоч одна команда, що запускає чи слухає: `…; python3 -c "…"` (run-1), `…; lsof -iTCP:3457`,
`npm --prefix … run start -- -p 3457` і `… && ls app/dashboard -R` (run-2). Тобто allowlist звужує запуск і
запис, але не читання. У run-2 агент, крім скіла, сам прочитав `node_modules/next/dist/docs/…/after.md` і
`02-guides/forms.md`, як вимагає блок Next.js в `AGENTS.md`.

## Task C — `integrating-n8n-webhooks`

**BASE для Task D: `8c6fbeb`** (`skills: add integrating-n8n-webhooks (contract, references, scripts)`).
У ньому є виправлення Task A й усі три скіли, але ще немає ні `/quotes`, ні переробленого виклику n8n:
`app/actions.ts:55` досі робить `await fetch(process.env.N8N_WEBHOOK_URL!, …)` без заголовків і таймауту.
Від `main` у `app/actions.ts` змінено лише `authorizeLead` з Task A (`git diff --stat main 8c6fbeb -- app/actions.ts`
→ 15+/1−). Тож прогін A не отримує від BASE жодного шматка контракту.

### Що залишилось у `SKILL.md`, а що пішло в `references/`

Записка має 398 рядків і 12 розділів. `SKILL.md` має 107 рядків: він вантажиться в контекст щоразу, коли скіл
спрацьовує, тому в ньому лише те, що потрібне в кожній задачі:

| У `SKILL.md` | Чому тут |
|---|---|
| `description` (981 символ): що робить скіл, «Use when», фрази команди («надішли лід у n8n», «n8n викличе ендпоінт, коли буде готово», «n8n повертає 403 / 524»), «Не для» | За ним агент вирішує, чи вантажити скіл. Тіло до цього моменту не прочитане |
| Контракт однією таблицею: змінні, хто говорить з n8n, запит, повтори, режим, колбек по кроках, журнали, runtime | Потрібен у кожній задачі. Без нього агент пише «як звик» |
| «Як робимо» з прямими посиланнями на кожен reference | Одне посилання на кожен файл, без ланцюжків |
| Чекліст із 8 пунктів, правила зупинки, Verify з командами | Ці речі не можна пропустити |
| Посилання на `server-auth-actions` і `server-after-nonblocking` за id | Правила Vercel не переписані |

| У `references/` | Що там |
|---|---|
| `contract.md` (143 р.) | Деталі й «чому»: змінні, запит, повтори, колбек по кроках із кодами, ідемпотентність, журнали, ліміти |
| `response-modes.md` (61 р.) | Режими Webhook, 100 с / 524, що означає кожен код відповіді, тестовий vs production URL, мок |
| `code-templates.md` (249 р. на момент Task C, 260 у v0.1.3) | `lib/n8n/client.ts`, сховище, Server Action з `after()` + `redirect()`, колбек-роут `app/api/n8n/[event]/route.ts` |
| `n8n-setup.md` (27 р.) | Налаштування воркфлоу на боці n8n текстом для клієнта |

Між файлами `references/` посилань немає (перевірено grep: 0). Розділи записки 11 («Відомі пастки») і 12
(«Поза межами») не скопійовані окремо. Вони стали правилами зупинки, пунктами чекліста й рядком «Не для» в
`description`.

**Правила зупинки** (без винятків «якщо задача потребує»):
- тестовий URL `/webhook-test/` у коді чи `.env.example`;
- секрет у Client Component, `NEXT_PUBLIC_`, query string, журналі чи відповіді;
- форма має чекати воркфлоу, довшого за ~10 с;
- колбек без підпису чи з іншою схемою підпису;
- зміна сенсу поля конверта;
- потрібні справжні значення змінних, нова npm-залежність або зміна воркфлоу клієнта;
- 403/404 на production-URL.

### `scripts/`

| Скрипт | Що робить |
|---|---|
| `check-contract.mjs` | Node без залежностей, 15 перевірок C1–C15: PASS/FAIL/N/A, для FAIL — `файл:рядок`, exit 1 при FAIL, 2 при помилці аргументів. Підтримує `--root`, `--changed-since <ref>` (змінені рядки + нові неіндексовані файли) і `--help`. Код перевіряється без коментарів; C1/C2 дивляться і в коментарі теж |
| `selftest-check-contract.mjs` | Доводить, що перевірки справжні (нижче) |
| `send-signed-callback.mjs` | Матриця колбеків проти запущеного роуту, секрет з `--env-file`, не друкує його. На момент Task C перевірено лише `--help` і вихід без секрету (exit 2), бо роуту ще не було. У Task D проти роуту B і гілки — 7/7, проти роуту A — 5/10 (`docs/ab-validation.md`) |
| `mock-n8n.mjs` | Копія `tools/mock-n8n.mjs` байт у байт |

### Вивід на `main`

Повний вивід: [`docs/evidence/task-c/check-contract-main.txt`](evidence/task-c/check-contract-main.txt).

```
$ mkdir ../leaddesk-main && git archive main | tar -x -C ../leaddesk-main
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ../leaddesk-main; echo "exit=$?"
C1   FAIL no test webhook URL (/webhook-test/) in code or .env.example
       .env.example:6  test webhook URL
C3   FAIL requests to n8n only from lib/n8n/client.ts
       app/actions.ts:54  fetch to n8n outside lib/n8n/client.ts
C4   FAIL … app/actions.ts:1  first statement is not import "server-only"
C5   FAIL … app/actions.ts:54  fetch without AbortSignal.timeout
C6   FAIL … app/actions.ts:54  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL … app/actions.ts:54  body is not the { version: 1, event, data } envelope
C8   FAIL … app/actions.ts:54  Server Action waits for n8n: no after()
C9–C12 N/A (колбек-роуту на main немає)
C15  FAIL … N8N_WEBHOOK_BASE_URL / N8N_WEBHOOK_TOKEN / N8N_CALLBACK_SECRET / APP_BASE_URL is missing
Summary: 3 PASS, 8 FAIL, 4 N/A
exit=1
```

На гілці в момент BASE (`8c6fbeb`) результат такий самий: 3 PASS, 8 FAIL, 4 N/A, бо Task A виклику n8n не торкався.
Після Task D на гілці 0 FAIL (нижче).

### Перевірки, яким на `main` нема що дивитись: навмисно поганий роут

Тимчасова тека з одним роутом: `JSON.parse` до перевірки підпису, порівняння `===`, без часу, без ключа,
`console.log` тіла. Теку після перевірки видалено. Результат —
[`bad-callback.txt`](evidence/task-c/bad-callback.txt):

```
C9   FAIL  app/api/n8n/[event]/route.ts:5  JSON.parse before the signature check
C10  FAIL  …:1 no timingSafeEqual · …:7 signature compared with === / !==
C11  FAIL  …:1 x-n8n-timestamp is not read
C12  FAIL  …:1 idempotency-key is not read
C14  FAIL  …:10 log call may print a body, personal data or a secret
Summary: 3 PASS, 5 FAIL, 7 N/A · exit=1
```

### Selftest: атака на власний скрипт

`selftest-check-contract.mjs` бере блоки `ts` прямо з `references/code-templates.md` і складає з них
проєкт: 15 з 15 PASS, exit 0. Отже шаблони, які скіл дає агенту, самі проходять перевірку. Далі йдуть 15
фікстур, кожна з яких ламає рівно одну перевірку, і кожна її ловить: FAIL, exit 1. Ще 3 кейси перевіряють
`--changed-since`. Вивід: [`selftest.txt`](evidence/task-c/selftest.txt), «all expectations met», exit 0.
Супутні FAIL (у C3 — ще C4/C6/C7, у C10 — ще C9) очікувані: прямий `fetch` поза клієнтом справді порушує
й ці пункти.

Selftest знайшов у `check-contract.mjs` три баги, які я виправив до коміту:
1. Коментар `// fetch to n8n` рахувався як код. Тепер код перевіряється без коментарів, а C1/C2 дивляться
   в сирий текст: тестовий URL у коментарі — теж витік.
2. `--changed-since` порівнював шляхи `/var/…` і `/private/var/…` (macOS) і не знаходив жодного зміненого
   файлу. Тепер обидва шляхи проходять через `realpath`.
3. Очікування в самому selftest шукало `app/legacy.ts` в усьому виводі, і його знаходив рядок заголовка.
   Тепер пошук іде лише по рядках знахідок `файл:рядок`.

> **Хибна тривога GitGuardian у PR.** Фікстура C15 перевіряє, що справжній на вигляд секрет у `.env.example` дає FAIL.
> Спершу вона містила вигаданий літерал `3f9a…6978`, і GitGuardian позначив його як «Generic High Entropy Secret».
> Це не справжній секрет: значення ніде не використовується і не збігається з жодним значенням `.env.local`
> (перевірено grep'ом без виводу значень). Тепер фікстура генерує значення під час запуску
> (`randomBytes(9).toString("hex")`). GitGuardian перевіряє кожен коміт PR, тому історію переписано: літерала немає
> в жодному коміті. Що саме змінилось і таблиця старих хешів — розділ «Переписана історія» наприкінці.

### На фінальному коді

Після перенесення прогону B і двох комітів доведення (`05aecc2`, `6832770`) вивід такий:
[`task-d/branch/check-contract-final.txt`](evidence/task-d/branch/summary.md).

```
n8n callers: app/actions.ts, lib/n8n/client.ts · callback routes: app/api/n8n/[event]/route.ts
Summary: 15 PASS, 0 FAIL, 0 N/A
exit=0
```

Там само видно дві неточності самого скрипта, знайдені на коді прогонів (подробиці в `docs/ab-validation.md`):
- C10 шукає `timingSafeEqual` лише у файлі роуту, а в прогонах A він лежить у `lib/`. Вердикт FAIL від цього
  не змінюється: HMAC там немає;
- C14 спрацьовує на `error.name`.

Обидві виправлено у v0.1.1 скіла (а C12 і шаблон колбека — у v0.1.2 після рев'ю CodeRabbit, див. розділ «Після рев'ю CodeRabbit»). Selftest з двома новими кейсами — «all expectations met», exit 0
([`task-c/selftest.txt`](evidence/task-c/selftest.txt)). На `main` вивід той самий: 3 PASS, 8 FAIL, 4 N/A.

## Після рев'ю CodeRabbit (PR #10, `@coderabbitai full review`)

CodeRabbit залишив 11 зауважень і один попереджувальний pre-merge check. Решта 10 checks — зелені, серед них Task A–E і
«Protected Paths And Secrets». Кожне зауваження я звірив з кодом перед правкою. Жодне не виявилось хибним, а одне
(формат `lead-created`) — це процесне рішення, не код.

| # | Зауваження | Що зроблено | Файли | Як перевірено |
|---|---|---|---|---|
| 1 | Шаблон колбека зберігає `documentUrl` без перевірки схеми | у шаблон додано `safeDocumentUrl` (лише `https:`), як у робочому роуті | `.claude/skills/integrating-n8n-webhooks/references/code-templates.md` | selftest складає «хороший» проєкт із цього шаблону: «all expectations met» |
| 2 | C12 проходить, якщо `jobId` лише згаданий | C12 тепер вимагає порівняння `===`/`!==` ключа з `` `${…jobId…}:${…}` `` | `scripts/check-contract.mjs`, `scripts/selftest-check-contract.mjs` (+1 фікстура: `jobId` є, звірки немає → FAIL) | selftest ✓; гілка 15/0; прогони: A1/A2 C12 FAIL, B1/B2 PASS — вердикти у звітах не змінились |
| 3 | Невдала доставка `lead-created` губиться | при `ok: false` або винятку — запис аудиту `lead.n8n_failed` (наявний `logAudit`), за ним лід можна надіслати знову з тим самим ключем | `app/actions.ts` | n8n вимкнено: 3 спроби, потім `db:insertAuditEntry: 2`; форма 0,44 с (`task-d/branch/lead-created-n8n-down.txt`) |
| 4 | Формат `lead-created` треба погодити з власником workflow | код не змінювали; вимога записана в коді й у `docs/n8n-integrations.md` | `app/actions.ts` (коментар), `docs/n8n-integrations.md` | — (процесне рішення людини) |
| 5 | Автооновлення без межі | не більше 60 оновлень (5 хв при кроці 5 с) | `components/auto-refresh.tsx` | `lint`, `build`; сценарій на гілці ✓ |
| 6 | Помилки полів форми кошторису недоступні скрінрідеру | `label htmlFor`, `aria-invalid`, `aria-describedby="quote-<поле>-error"`, підсумок `role="alert"` — крок 5 скіла `building-client-form` | `components/quote-form.tsx` | порожня відправка без JS: 4 × `aria-invalid`, 4 id помилок, `role="alert"` (`task-d/branch/quote-form-a11y.txt`); сценарій 303 за 0,136 с |
| 7 | «трьох комітів» у розділі перенесення неоднозначно | названо всі три коміти | `docs/ab-validation.md` | — |
| 8 | `stop_server` міг убити чужий процес на :3000 | `kill -9` лише якщо власник порту досі `SERVER_PID` | `docs/evidence/bin/server.sh` | усі прогони нижче використовують цей `server.sh` |
| 9 | Скрипт атаки лише друкує | звіряє статус після кожного POST, exit 1 при дірці | `docs/evidence/task-a/attack-server-actions.sh` | гілка → «protected (exit 0)»; вразливий `77882b5` → «NOT protected (exit 1)», marta змінила статус (`task-a/attack-after-review-*.txt`) |
| 10 | `nojs-isolation.sh` підключав `server.sh` з тимчасової теки | шлях від розташування скрипта | `docs/evidence/task-b/nojs-isolation.sh` | код run-2 (`9297071` + `run-2/agent.diff`) у тимчасовому worktree: HTTP 200 за 0,53 с (`task-b/nojs-after-review.txt`) |
| 11 | `verify-note-form.sh` лише друкує | кожен пункт — ok/FAIL, exit 1 при FAIL; таймаут = HTTP 000 = FAIL | `docs/evidence/task-b/verify-note-form.sh` | run-2 → 6/6 ok, exit 0; run-1 → FAIL на 3 no-JS пунктах, exit 1 — те саме, що записано в Task B (`task-b/verify-after-review-*.txt`) |
| — | Pre-merge: в описі PR лишився шаблонний HTML-коментар | коментар прибрано з опису PR | опис PR | — |

Скіл n8n після цього — v0.1.2 (п. 1–2). Попутно прибрано невикористаний імпорт у `docs/evidence/bin/pack-evidence.mjs`
(єдине попередження `npm run lint`). Після всіх правок: `npm run lint` — 0 проблем, `npm run build` ✓,
`check-contract.mjs` — 15 PASS / 0 FAIL, selftest — «all expectations met».

## Переписана історія (GitGuardian)

GitGuardian у PR перевіряє кожен коміт, а не лише фінальне дерево, тож виправлення в пізнішому коміті check не
лагодило. Тому 21 коміт, від першого коміту n8n-скіла до останнього, переписано `git filter-branch`:

- **Що змінено:** у кожному коміті, де був літерал, рядок фікстури C15 у
  `.claude/skills/integrating-n8n-webhooks/scripts/selftest-check-contract.mjs` замінено тим самим кодом, що вже був
  на фінальному дереві (`randomBytes(9).toString("hex")` і його імпорт). Інші файли, автори й дати комітів не змінені.
  Коміт `24d41ce` раніше вносив цю правку. Тепер він лише додає примітку в цей звіт, тому його повідомлення переписано.
- **Як перевірено:** `git diff <старий HEAD> <новий HEAD>` порожній, тобто фінальний код байт у байт той самий.
  Кожна пара старий/новий коміт відрізняється лише файлом selftest, і лише до `0c02097` включно.
  Пошук літерала по всій новій історії (`git log -S` з повним значенням) нічого не знаходить. Selftest на першому переписаному коміті `8c6fbeb` —
  «all expectations met».
- **Що не змінено:** 17 комітів до n8n-скіла, зокрема `eaf292a` (рев'ю до встановлення) і `3c354e2`
  (встановлення). Записані докази теж не змінено. Там, де `summary.md` чи транскрипт називає старий хеш, його
  відповідник — у таблиці. Копії A/B (код — старий `898aa2b`, тека скіла — старий `8118cd0`) і копію тесту спрацювання
  (старий `8118cd0`) зроблено до переписування. Їхні дерева відрізняються від нових `8c6fbeb` і `2f4fa4f` лише цим
  рядком selftest.

| Старий хеш (у записаних доказах) | Новий хеш (у звітах) | Коміт |
|---|---|---|
| `898aa2b` | `8c6fbeb` | skills: add integrating-n8n-webhooks (contract, references, scripts) |
| `8118cd0` | `2f4fa4f` | docs: Task C verification (check-contract on main, bad route, selftest) |
| `918f623` | `8cf9d4a` | docs: Task D A/B runs (2 without skill, 2 with skill): diffs, contract checks, mock scenarios |
| `e763331` | `88b2e8b` | docs: Task D diffs as real patches (the first copy was RTK-compacted git diff output) |
| `8c7705f` | `c94da6f` | feat(quotes): quote request form, n8n trigger and signed callback (run B of Task D) |
| `b6d5a23` | `05aecc2` | fix(n8n): send new leads through lib/n8n/client inside after() |
| `9ab228f` | `6832770` | chore(env): drop the /webhook-test/ lead URL from .env.example |
| `d899526` | `266f9d1` | docs: Task D report (A/B comparison, carry-over of run B, final check-contract 0 FAIL) |
| `5b15a8b` | `eab812c` | skills(integrating-n8n-webhooks): v0.1.1, C14 ignores error.name, C10 says it checks the route file only |
| `00eae96` | `32e3177` | docs: Task E2 trigger evals for integrating-n8n-webhooks (12/12) |
| `55c2da1` | `bd6ae06` | docs: pack evidence into summary.md + transcript.md per run and one raw-evidence.tar.gz |
| `aea1a62` | `2f61e6a` | docs: reports name every changed file; review edit history; evidence links explained |
| `6356df4` | `0c02097` | docs(verification): table of every file changed against main (generated) |
| `6f82e8a` | `24d41ce` | docs(verification): note on the GitGuardian finding for the C15 selftest fixture |
| `0b0cea4` | `56a368d` | docs(verification): regenerate the changed-files table |
| `1661304` | `8dc7c03` | fix(quotes): accessible field errors and a refresh limit (CodeRabbit review) |
| `eecb46e` | `a362951` | fix(n8n): record lead-created that n8n did not accept (CodeRabbit review) |
| `51fad13` | `825fec0` | skills(integrating-n8n-webhooks): v0.1.2, C12 requires the key comparison; template keeps only https documentUrl |
| `3c80e71` | `0923e70` | chore(evidence): scripts assert their expectations; stop_server never kills a foreign :3000 owner |
| `4f2fbd8` | `4c083f3` | docs: CodeRabbit review follow-up in verification.md and ab-validation.md |
| `f2f4ca7` | `0db6742` | docs(verification): regenerate the changed-files table |

## Після аудиту (коміт `12b3397`)

Аудит гілки знайшов три дефекти в коді фічі кошторису (Task D, код прогону b1) і дві неточності в
`docs/ab-validation.md`. Для дефектів написано регресійну перевірку
[`task-d/audit-regress.mjs`](evidence/task-d/audit-regress.mjs), її запускає `audit-regress.sh`. Скрипт
збирає продакшн-версію з тестовими значеннями секретів, які генерує сам, ніде не друкує й не бере з `.env.local`.
Він грає роль n8n на :5679 і завершується з exit 1 при будь-якому FAIL. Виводи —
[`task-d/branch/summary.md`](evidence/task-d/branch/summary.md), розділи `audit-*.txt`.

| # | Дефект | Відтворено до виправлення (`12b3397`) | Виправлення | Файли, коміт |
|---|---|---|---|---|
| 1 | Готовий кошторис повертається в `sent` | n8n кличе колбек до відповіді 202, затримка 0…400 мс з кроком 20: 4 з 21 запиту лишились «Готуємо кошторис» (40, 60, 80, 100 мс) | `updateQuote(id, patch, "queued")`: перевірка статусу й запис в одному кроці | `lib/db.ts`, `app/quotes/actions.ts` · `568ccac` |
| 2 | Бюджет перетворюється неправильно | `1500,50` → 150050, `1 500,5` → 15005, `1,2,3` → 123, `1,500` → 1500, `1e3` → 1000, `0x10` → 16, `1500.50` → 1501 | формат: цілі долари, пробіли між розрядами, до 2 знаків після `.` або `,`; інше — помилка поля. `inputMode="decimal"` | `lib/quote-form.ts`, `components/quote-form.tsx` · `9d056af` |
| 3 | Колбек приймає суперечливі `event` і `status` | `quote-request.completed` + `failed` → 202, кошторис став `failed`; `.failed` + `completed` → 202, став `ready` | `` body.event === `${event}.${d.status}` ``, інакше 400 і ключ звільняється | `app/api/n8n/[event]/route.ts` · `400a450` |

- **До:** `audit-before.txt` — 6 ok, 10 FAIL. **Після:** `audit-after.txt` на `c3545ea` — 16 ok, 0 FAIL.
- **Абляція:** усі виправлення в дереві, повертаю одне. Без №2 — 7 FAIL, усі в бюджеті. Без №3 — 2 FAIL, обидва
  про `event`/`status`. Без №1 — 1 FAIL, гонка: знову 40…100 мс. Кожна перевірка ловить свій дефект і лише його.
- **Скіл:** №1 і №3 дослівно були в шаблонах `references/code-templates.md` v0.1.0, і обидва прогони B переписали
  їх звідти. У v0.1.3 (`c3545ea`) шаблони пишуть статус одним кроком і звіряють `event` з `status`, а коментар до
  розбору форми задає формат бюджету. У `references/contract.md`, крок 7, додано лише вимогу збігу `event` ↔
  `data.status`.
  `check-contract.mjs` ці дефекти не ловить: вони в логіці статусів, а не в контракті з n8n.
- **`docs/n8n-integrations.md`:** описано формат `budget` у `data`, вимогу збігу `event` ↔ `status` і правило
  запису `sent`/`failed`.
- **Неточності звіту A/B:**
  - «агент узяв із загальних знань» замінено на «у зафіксованих читаннях джерела не знайдено; ймовірно, базові
    знання». Для `after()` і `RouteContext` додано порядок з транскриптів: сторінку прочитано чи знайдено Grep'ом
    раніше, ніж з'явився код;
  - «`init.skills` збігається» замінено точним описом. `/context` показує 16 вбудованих скілів, `init.skills` — 21,
    переліки різні. Спільне в обох: в A немає `integrating-n8n-webhooks`, у B він є.
- **Фінальні перевірки на коді після виправлень:**
  - `npm run lint` — 0 проблем;
  - `npx tsc --noEmit` — 0 помилок;
  - `npm run build` — успішно, його запускають `audit-regress.sh` і `scenario.sh`;
  - `check-contract.mjs` — 15 PASS / 0 FAIL (`check-contract-after-audit.txt`);
  - selftest — «all expectations met»;
  - повний сценарій `scenario-after-audit.txt`: форма без JS → 303 за 0,135 с → мок `202 auth=ok` → підписаний
    колбек 202 → «Кошторис готовий», матриця колбека 7/7, персональних даних у журналі сервера 0.

  Результати прогонів A/B у `docs/ab-validation.md` — історичні, зняті на коді агентів до цих виправлень.
- **Друга пара A/B (A3/B3)** за рекомендацією аудиту: той самий BASE і запит, однакові й ширші дозволи на
  `lint`/`build`, скіл v0.1.3. A3 — 9 FAIL, B3 — 0 FAIL і 0 дефектів аудиту. Опис, дозволи, обмеження —
  `docs/ab-validation.md`, розділ «Друга пара».

## Після код-рев'ю (коміт `5b03b14`)

Код-рев'ю гілки (`/code-review`, high) дало 7 зауважень. Усі виправлено окремими комітами. Два перевіряються
поведінкою: для них у `audit-regress.mjs` додано кейси, відтворено до виправлення й підтверджено абляцією.
Виводи — [`task-d/branch/summary.md`](evidence/task-d/branch/summary.md), розділи `review-*.txt`.

| # | Зауваження | Що зроблено | Файли, коміт | Як перевірено |
|---|---|---|---|---|
| 1 | Колбек `failed` іншого запуску n8n перетворював готовий кошторис на `failed` | `failed` пишеться лише з `queued`/`sent`, одним кроком (`ifStatus` списком). Колбек приймається (202), але статус не змінює | `app/api/n8n/[event]/route.ts`, `lib/db.ts` · `bcb9c05` | до: сторінка «Не вдалося…» після `completed` + `failed`; після: «Кошторис готовий»; абляція — 1 FAIL, саме цей |
| 2 | Бюджет обрізався до 32 символів до перевірки: `"5"` + 31 пробіл + `"0"` → 5 | поле читається на символ довше, понад 32 символи — помилка поля | `lib/quote-form.ts` · `01f2951` | до: «n8n got 5»; після: помилка форми; абляція — 1 FAIL, саме цей |
| 3 | Відмова `statsPromise` могла лишитися необробленою, якщо раніше впаде `Promise.all` | `statsPromise.catch(() => {})`; `<Stats>` і далі чекає оригінальний проміс | `app/dashboard/page.tsx` · `01c9f39` | `tsc`, `build`; окремого тесту немає, збій бази тут не відтворюється |
| 4 | Будь-яка помилка запуску воркфлоу журналювалась як `not-configured` | `N8nConfigError` для налаштувань; у журнал — лише `error.name` | `lib/n8n/client.ts`, `app/quotes/actions.ts` · `45f20f5` | `review-config-log.txt`: з `/webhook-test` у журналі `"status":"N8nConfigError"`, персональних даних 0 |
| 5 | Застовплені ключі колбеків зберігались вічно | `Map` ключ → час, записи старші за 24 год видаляються. Не 300 с: n8n перепідписує повтор колбека, тож вікно підпису повторів не обмежує | `lib/db.ts` · `bcb9c05` | `tsc`, `build`, регресія й матриця колбека проходять; очищення за добу тестом не перевірено |
| 6 | `audit-regress.mjs` падав з TypeError, якщо n8n не отримав запит | такий кейс — рядок FAIL і далі | `docs/evidence/task-d/audit-regress.mjs` · `af2c1ae` | читанням коду; усі прогони нижче — цим скриптом |
| 7 | `changed-files.mjs` записав би перейменування під старою назвою | `--no-renames`: перейменування — рядки «видалено» + «додано» | `docs/evidence/bin/changed-files.mjs` · `af2c1ae` | `--check` проходить |

- **Скіл v0.1.4** (`8ce4d38`): шаблон колбека в `references/code-templates.md` так само не знімає `ready`, а
  коментар до `claimCallbackKey` велить зберігати ключі близько доби.
- **Регресія:** `review-before.txt` на `5b03b14` — 16 ok, 2 FAIL (нові кейси); `review-after.txt` на `af2c1ae` —
  18 ok, 0 FAIL. У «Після аудиту» вище скрипт мав 16 перевірок; ті виводи зняті до цього розширення.
- **Фінальні перевірки:** `npm run lint` і `npx tsc --noEmit` — 0 помилок, `npm run build` успішний,
  `check-contract.mjs` 15 PASS / 0 FAIL, selftest «all expectations met». Повний сценарій
  (`scenario-after-code-review.txt`): 303 за 0,135 с → мок 202 → колбек 202 → «Кошторис готовий», матриця 7/7,
  персональних даних у журналі 0.
