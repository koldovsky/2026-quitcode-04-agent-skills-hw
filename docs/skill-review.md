# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення (цей файл закомічено окремим комітом раніше за коміт зі скілом).
> Файли скіла читались як дані: нічого з них не виконувалось, клон не відкривався як проєкт в агенті.

**Дата, інструмент, ОС:** 27.09.2026 · Claude Code (VS Code extension, модель Opus 5.5) · Windows 10 Pro 19045 + Git Bash · Node 24.16.0

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/vercel-labs/agent-skills> |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` (назва теки в джерелі ≠ `name`; після встановлення CLI кладе скіл у теку за `name`) |
| Версія | release-тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` → коміт `063bee94c3f4df8453406c830b0a7df0f2860278` (28.08.2026, merge PR #328) |
| Навіщо нам | Клієнт скаржиться на дашборд > 2 с і «задумливу» форму; експерта з продуктивності React у команді немає. Скіл дає 70 правил з id, за якими агент робить рев'ю й виправлення |

## 1. Подивитись, не встановлюючи

- Як дивились: неглибокий клон тега **поза** репозиторієм —
  `git clone --depth 1 --branch agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 https://github.com/vercel-labs/agent-skills.git ../review-agent-skills`;
  `git rev-parse HEAD` → `063bee94c3f4df8453406c830b0a7df0f2860278`. Файли переглядались командами з
  чеклісту нижче (`find`, `awk`, `grep`, `node`-перевірка на невидимі символи).
  `npx skills@1.7.0 add … --list` запускала людина у своєму терміналі (див. розділ 3).
- Склад скіла (76 файлів у клоні, 418 КБ; після встановлення очікується 75 — CLI не копіює `metadata.json`):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7,4 КБ | Frontmatter + таблиця 8 категорій і список 70 правил з id та однорядковим описом; посилання на `rules/<id>.md` і `AGENTS.md` |
  | `rules/` | 72 файли `.md` | По файлу на правило (опис, «incorrect/correct» приклади) + `_sections.md`, `_template.md` |
  | `AGENTS.md` | 112 КБ | Усі правила, зібрані в один документ (генерується з `rules/`) |
  | `README.md` | 3,5 КБ | Опис для людей: як збирається `AGENTS.md`, структура правил |
  | `metadata.json` | 0,9 КБ | Версія `1.0.0`, «Vercel Engineering», список посилань-джерел. Не виконується |

- Frontmatter `SKILL.md`: `name`, `description`, `license: MIT`, `metadata` (`author: vercel`, `version: "1.0.0"`).
  **Немає** `allowed-tools`, `hooks`, `context`, `model`, `disable-model-invocation`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли (`.sh`, `.mjs`, `.py`…) | **Немає.** Єдиний не-markdown файл — `metadata.json` (дані). Скрипти збирання (`packages/react-best-practices-build`, `scripts/build-discovery-index.mjs`) лежать у корені репозиторію, **поза** текою скіла, і в проєкт не потрапляють | `find "$S" -type f ! -name "*.md"` |
| `allowed-tools` | **Немає** — скіл не дає собі попередніх дозволів | `awk '/^---$/{n++; next} n==1' "$S/SKILL.md"` |
| Команди під час рендеру `` !`cmd` `` | **Немає** (0 збігів) | `grep -rn '!`' "$S"` |
| Хуки, MCP-сервери, `plugin.json`, вимога API-ключів | **Немає** (0 файлів `*hooks*.json`, `*mcp*.json`, `plugin.json`, `settings*.json`); ключів скіл не просить | `find "$S" -name "*hooks*.json" -o -name "*mcp*.json" -o -name "plugin.json" -o -name "settings*.json"` |
| Інструкції агенту щось завантажити чи виконати (`npx`, `curl`, «завантаж правила з URL») | 2 збіги, обидва — **приклад у правилі**, не інструкція агенту: `npx svgo --precision=1 --multipass icon.svg` у `rules/rendering-svg-precision.md:27` і той самий рядок у `AGENTS.md:2477` (порада людині стиснути SVG). `curl`/`wget`/`WebFetch` — 0 | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch" "$S"` |
| Посилання: куди ведуть, чи є «прочитай інструкції звідси» | 35 унікальних URL: документація react.dev, nextjs.org, vercel.com/blog і docs, MDN, esbuild, webpack, vite, npm, GitHub (`isaacs/node-lru-cache`, `shuding/better-all`), gist, jsfiddle, x.com, а також заглушки `example.com`. Жодне не подане як «прочитай/завантаж інструкції звідси» — це джерела й «Reference:» | `grep -rhoE "https?://…" "$S" \| sort -u` |
| Приховані інструкції: HTML-коментарі, «ignore previous…», невидимі символи, base64 | **Немає:** 0 збігів на `ignore previous` / `system prompt` / `<!--`; 0 файлів із zero-width символами; 0 рядків, схожих на base64 (≥ 80 символів) | `grep -rniE …`, `node -e …` з шаблону, `grep -rnoE "[A-Za-z0-9+/]{80,}={0,2}"` |

Висновок розділу: скіл — **лише текст** (markdown + JSON з метаданими). Він нічого не виконує й не
завантажує, дозволів собі не дає. Основний ризик — не безпека, а **якість порад** для нашої версії
Next.js (розділ 5).

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen (Agent Trust Hub) | skills.sh: Pass · CLI: **Safe** | дати не показано ні на skills.sh, ні в CLI |
| Socket | skills.sh: Pass · CLI: **0 alerts** | не показано |
| Snyk | skills.sh: Pass · CLI: **Low Risk** | не показано |

- Де взяли: сторінка <https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices>
  (27.09.2026): усі три — Pass; 746,9 тис. встановлень; «First seen» — 19.01.2026.
  Блок «Security Risk Assessments» з CLI (людина запустила встановлення у своєму терміналі **без**
  `DISABLE_TELEMETRY`, 27.09.2026): `Gen: Safe · Socket: 0 alerts · Snyk: Low Risk`, «Details:
  https://skills.sh/vercel-labs/agent-skills». Цей блок з'явився **до** питання «Proceed with
  installation?», тобто до встановлення. Snyk у CLI — «Low Risk», а не «чисто»: деталей CLI не дає; з
  огляду на розділ 2 (жодного виконуваного коду) це прийнятно. CLI теж не показує SHA/версію аудиту.
- Чому CLI може не показати блок: з `DISABLE_TELEMETRY=1` (або `DO_NOT_TRACK=1`) CLI аудити не
  завантажує взагалі; коли CLI запускає агент, він сам вмикає `--yes`, і встановлення йде без
  підтвердження. Тому встановлення запускає людина у звичайному терміналі.
- До чого прив'язаний аудит: на skills.sh — до пари «репозиторій + назва скіла»
  (`vercel-labs/agent-skills` / `vercel-react-best-practices`), **а не до нашого тега**. На сторінці
  немає ні SHA, ні версії, на якій проганявся аудит. Тобто «Pass» стосується якогось стану скіла, не
  обов'язково `063bee9…`. Тому власна перевірка з розділу 2 (на файлах саме цього тега) — основна,
  а аудит — додатковий сигнал.

## 4. Ліцензія й походження

- Ліцензія: **MIT** — заявлена в frontmatter `SKILL.md` (`license: MIT`) і в розділі «License» у
  `README.md` репозиторію. Окремого файлу `LICENSE` у корені репозиторію на цьому тезі **немає**,
  тож повного тексту ліцензії з іменем правовласника в клоні немає. Для навчального/клієнтського
  проєкту прийнятно, але варто знати: формально MIT вимагає зберігати текст ліцензії при поширенні.
- Видавець і активність: організація `vercel-labs` (Vercel). Автор у метаданих — `vercel`,
  «Vercel Engineering». Останній коміт на тезі — 28.08.2026 (Aurora Scharff, merge PR #328), тобто
  репозиторій активно підтримується. На skills.sh — 746,9 тис. встановлень, у каталозі з 19.01.2026.

## 5. Чи правдивий зміст для нашого стеку

Звірено з документацією встановленого Next.js **16.3.5** (`node_modules/next/dist/docs/`):

| Порада скіла (id) | Що каже скіл | Що каже документація нашої версії | Висновок |
|---|---|---|---|
| `async-parallel` | Незалежні `await` — через `Promise.all()` | `01-app/01-getting-started/06-fetching-data.md` → «Parallel data fetching»: layouts і pages рендеряться паралельно, але «within any component, multiple async/await requests can still be sequential»; приклад з `Promise.all` | **Діє.** Застосовуємо в `app/dashboard/page.tsx` |
| `server-cache-react` | `React.cache()` для дедуплікації auth і запитів до БД у межах запиту; **не** передавати inline-об'єкти як аргументи (порівняння через `Object.is`) | `06-fetching-data.md` → «Reusing data with `React.cache`»: для доступу до даних без `fetch` (ORM, БД) — обгорнути в `React.cache`; кеш «scoped to the current request only». `02-guides/data-security.md` радить кешований `getCurrentUser` у Data Access Layer | **Діє.** У нас `getCurrentUser` без `cache()`, а `getWorkspace` обгорнуто, але викликається з inline-об'єктом `{ slug }`, тобто кеш ніколи не спрацьовує |
| `server-serialization` | У Client Component передавати лише поля, які він використовує | `02-guides/data-security.md`: Data Access Layer має повертати «safe, minimal Data Transfer Objects (DTOs)», «only return the data relevant for this query and not everything» | **Діє**, і це ще й питання безпеки (у браузер потрапляють IP, user-agent, `rawPayload`, внутрішні нотатки). Застосовуємо в `LeadsTable` |
| `bundle-barrel-imports` | Для бібліотек-«бочок» — `experimental.optimizePackageImports` у `next.config` | `03-api-reference/05-config/01-next-config-js/optimizePackageImports.md`: список «optimized by default» уже містить **`recharts`** і **`lodash-es`**, але **не `lodash`** | **Частково.** Для `recharts` порада зайва (Next 16 робить це сам). Для `lodash` доречна, але в `lead-search.tsx` краще взагалі не тягнути lodash заради одного `debounce`. Всліпу `recharts` у конфіг не додаємо |

**Допис після виправлень (крок 5 Task A).** Застосовано 4 правила — `async-parallel`,
`server-cache-react`, `server-serialization`, `server-auth-actions` (деталі й числа — у
`docs/verification.md`). Що з'ясувалось на практиці:

- `server-cache-react` — у нашому коді `cache()` вже **був** на `getWorkspace`, але не працював через
  inline-об'єкт `{ slug }` в аргументі. Саме застереження скіла про `Object.is` пояснило, чому лічильник
  `db:getWorkspace` показував 3 виклики на запит. Порада правдива для React 19.2 / Next 16.3.5.
- `server-cache-react` **не прискорив** сторінку (TTFB без змін): Next 16 рендерить layout і page
  паралельно (`06-fetching-data.md`), тож дублікати йшли одночасно. Виграш — у 3× меншому
  навантаженні на БД, а не в часі. Скіл цього нюансу не згадує.
- `server-parallel-fetching` (перебудова дерева компонентів) **не знадобився**: після `async-parallel`
  найдовший запит (`getLeadStats`, 1,2 с) і так визначає час; дальше покращення — стрімінг через
  `<Suspense>` (`async-suspense-boundaries`), не застосовували.
- `bundle-barrel-imports` для `recharts` — **зайвий** у Next 16 (уже в списку
  `optimizePackageImports` за замовчуванням), тому в `next.config.ts` його не додавали.
- `server-auth-actions`: приклад у скілі кидає `unauthorized(...)` з власного `@/lib/errors`. У Next 16
  є вбудований `unauthorized()` з `next/navigation`, але він експериментальний і потребує
  `experimental.authInterrupts` — тому для відмови використали `redirect("/login")` (через наявний
  `getCurrentUser`) і `throw new Error(...)`, без зміни конфігурації.
- `server-after-nonblocking` для `submitLead` свідомо **відкладено** до Task D: це частина переробки
  виклику n8n за контрактом, її робитиме агент у прогонах A/B.

## 6. Закріплення версії й коміт

- Команда встановлення (запускає людина у своєму терміналі, **не агент**):
  ```bash
  DISABLE_TELEMETRY=1 npx skills@1.7.0 add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 \
    --skill vercel-react-best-practices -a claude-code --copy
  ```
  (для перегляду аудитів — та сама команда **без** `DISABLE_TELEMETRY=1`). Scope — **Project**.
- Де лягли файли; справжні файли чи посилання: `.claude/skills/vercel-react-best-practices/`,
  **справжні файли** (`--copy`), без junction/symlink і без другої копії в `.agents/skills/`.
  **Факт (після встановлення):** `.claude/skills/vercel-react-best-practices/` — звичайна тека
  (PowerShell `(Get-Item …).LinkType` порожній), 75 файлів; `ls .agents` → немає; `diff -r` з
  відрев'юваним клоном тега — ідентично, окрім відсутнього `metadata.json` (очікувано).
  Коміт `5ad1deb`; у `skills-lock.json`: `ref: agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278`,
  `computedHash: 6b526d01…60ca6b`.
- Що потрапило в git: тека скіла (очікується 75 файлів) і `skills-lock.json` (джерело, тег, хеш).
- Як оновлювати: та сама команда з новим тегом (або `npx skills@1.7.0 update`) → `git diff` на теці
  скіла → рев'ю змін за цим чеклістом (нові скрипти, `allowed-tools`, хуки, посилання, приховані
  інструкції) → коміт з тегом у повідомленні. Відновлення зі `skills-lock.json`
  (`experimental_install`) пише лише в `.agents/skills/`, яку Claude Code не читає, тому справжні
  файли тримаємо в git.

## Вердикт

**Встановити з умовами.** Ризик низький: скіл — лише markdown і JSON, без скриптів, хуків, MCP,
`allowed-tools` і прихованих інструкцій; видавець — Vercel, ліцензія MIT, аудити Pass. Проте аудит
прив'язаний не до нашого тега, тож спираємось на власну перевірку файлів саме `063bee9…`. Умови:
версія закріплена тегом і `skills-lock.json`, файли справжні й лежать у git; **кожну пораду звіряємо
з документацією Next.js 16.3.5** перед застосуванням (див. розділ 5 — частина порад уже вбудована в
Next 16); оновлення лише через повторне рев'ю діфу.
