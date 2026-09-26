# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення (коміт з цим файлом іде раніше за коміт зі скілом — див. `git log`).
> Файли скіла читали як дані: нічого з них не виконували, теку клону як проєкт в агенті не відкривали.

**Дата, інструмент, ОС:** 26.09.2026 · Claude Code 2.1.283 (Opus 5.5) · macOS (Darwin 24.6) + zsh · Node 22.20.0

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/vercel-labs/agent-skills> |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` |
| Версія | тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` = коміт `063bee94c3f4df8453406c830b0a7df0f2860278` (2026-08-28, merge PR #328) |
| Навіщо нам | Клієнт скаржиться: `/dashboard` відкривається > 2 с, форма «думає». Експерта з продуктивності React у команді немає — беремо правила Vercel як чекліст для рев'ю й виправлень |

## 1. Подивитись, не встановлюючи

- Як дивились:
  1. `DISABLE_TELEMETRY=1 npx skills@1.7.0 add "vercel-labs/agent-skills#agent-skills-063bee9…" --list` — CLI показав 10 скілів
     пакета з описами (серед них `vercel-react-best-practices`), у репозиторій нічого не записав (`git status` чистий).
  2. `git clone --depth 1 --branch agent-skills-063bee9… https://github.com/vercel-labs/agent-skills.git ../review-agent-skills`
     — неглибокий клон **поза** репозиторієм; `git rev-parse HEAD` = `063bee94c3f4…`.
- Склад скіла (76 файлів у клоні, 416 КБ):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7,3 КБ | frontmatter + таблиця 8 категорій і перелік 70 правил з id; посилання на `rules/<id>.md` і `AGENTS.md` |
  | `AGENTS.md` | 108 КБ | усі правила, зібрані в один документ («Full Compiled Document») |
  | `README.md` | 3,4 КБ | опис для людей, як додавати правила |
  | `rules/*.md` | 72 файли | по файлу на правило (+ `_sections.md`, `_template.md`): пояснення, неправильний/правильний приклад |
  | `metadata.json` | 921 Б | версія 1.0.0, «Vercel Engineering», список посилань. CLI його не копіює → після встановлення 75 файлів |

- Frontmatter `SKILL.md`: `name`, `description`, `license: MIT`, `metadata` (`author: vercel`, `version: "1.0.0"`).
  **Немає** `allowed-tools`, `hooks`, `context`, `disable-model-invocation`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли | Немає. Єдиний не-markdown файл — `metadata.json` (дані) | `find "$S" -type f ! -name "*.md"` |
| `allowed-tools` | Немає | `awk '/^---$/{n++; next} n==1' "$S/SKILL.md"` |
| Команди під час рендеру `` !`cmd` `` | Немає | `grep -rn '!`' "$S"` — 0 збігів |
| Хуки, MCP-сервери, `plugin.json`, API-ключі | Немає | `find "$S" -name "*hooks*.json" -o -name "*mcp*.json" -o -name "plugin.json" -o -name "settings*.json"` — 0 |
| Інструкції агенту щось завантажити чи виконати | Лише `npx svgo --precision=1 --multipass icon.svg` у `rules/rendering-svg-precision.md:27` (і його копія в `AGENTS.md:2477`) — приклад оптимізації SVG для людини, не «виконай зараз». У нашому проєкті SVG-іконок немає, правило не застосовуємо | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch" "$S"` |
| Посилання | 35 унікальних: react.dev, nextjs.org, MDN, vercel.com/blog, github (lru-cache, better-all), swr, esbuild/vite/webpack, `example.com` у прикладах. Жодного «прочитай інструкції звідси» / «завантаж правила з URL» | `grep -rhoE "https?://…" "$S" \| sort -u` |
| Приховані інструкції | Немає: 0 збігів «ignore previous / system prompt / `<!--`», 0 файлів із zero-width символами, немає довгих base64-рядків | `grep -rniE …`, node-скрипт із шаблону, `grep -rnoE "[A-Za-z0-9+/]{80,}"` |

Висновок розділу: скіл — **лише текст** (markdown + JSON), нічого не виконує й нічого не просить агента виконати чи завантажити.

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen (Agent Trust Hub) | Pass | не вказана |
| Socket | Pass | не вказана |
| Snyk | Pass | не вказана |

- Де взяли: сторінка <https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices> (26.09.2026). Там же:
  744,7K встановлень, 31,5K зірок репозиторію, «First Seen: Jan 19, 2026».
- Чому не з CLI: з `DISABLE_TELEMETRY=1` CLI аудитів не завантажує взагалі; а коли CLI запускає агентська
  сесія, він сам вмикає `--yes` і встановлює, не чекаючи підтвердження, — блок аудитів уже нічого не
  зупиняє. Тож у цій сесії CLI використовували лише для `--list` (нічого не встановлює), аудити читали на skills.sh.
- До чого прив'язаний аудит: на сторінці немає ні тега, ні SHA — аудит прив'язаний до пари «репозиторій + назва
  скіла», тобто, найімовірніше, до поточного `main`, а не до нашого тега. Тому аудит — додатковий сигнал, а
  основна перевірка — власний розбір закріпленої версії (розділ 2).

## 4. Ліцензія й походження

- Ліцензія: **MIT** — у frontmatter `SKILL.md` (`license: MIT`) і в розділі «License» `README.md` репозиторію.
  Окремого файлу `LICENSE` у корені репозиторію на цьому тезі немає (`ls LICENSE*` — нічого) — дрібна
  неохайність, але намір ліцензіара однозначний.
- Видавець і активність: організація `vercel-labs` (Vercel); останній коміт тега — 2026-08-28 (Aurora Scharff,
  merge PR #328), активна розробка; 31,5K зірок, ~745K встановлень скіла.

## 5. Чи правдивий зміст для нашого стеку

Звірено з `node_modules/next/dist/docs/` (Next.js 16.3.5):

| Порада скіла (id) | Що каже скіл | Що каже документація нашої версії | Висновок |
|---|---|---|---|
| `async-parallel` | Незалежні `await` — через `Promise.all()` | `01-getting-started/06-fetching-data.md` → «Parallel data fetching»: саме `Promise.all`; примітка — одна помилка валить усе (`allSettled`) | ✅ Застосовуємо в `app/dashboard/page.tsx` |
| `server-cache-react` | `React.cache()` для дедуплікації запитів до БД/автентифікації в межах одного запиту; не передавати inline-об'єкти як аргументи | Той самий файл: `import { cache } from 'react'` + `getUser = cache(async (id) => …)` | ✅ Застосовуємо до `getCurrentUser`. Заразом бачимо, що наш `getWorkspace({ slug })` — рівно той антипатерн «inline object → завжди cache miss», про який попереджає правило |
| `server-serialization` | У Client Component передавати лише потрібні поля | `02-guides/data-security.md` радить DTO — повертати клієнту мінімум | ✅ Застосовуємо до `LeadsTable` (отримує весь `Lead` з `rawPayload`, IP, user agent, нотатками) |
| `bundle-barrel-imports` | Додати бібліотеки в `experimental.optimizePackageImports` | `03-api-reference/05-config/01-next-config-js/optimizePackageImports.md`: опція досі `experimental`, але `recharts` і `lodash-es` оптимізуються **за замовчуванням**, додавати їх не треба. Наш `lodash` (CommonJS, не `-es`) у списку немає | ⚠️ Для `recharts` порада зайва; для `lodash` — простіше імпортувати `lodash/debounce` або обійтись без lodash |
| `bundle-dynamic-imports` | `next/dynamic(..., { ssr: false })` | `02-guides/lazy-loading.md:94`: «`ssr: false` is not allowed with `next/dynamic` in Server Components» — помилка збірки | ⚠️ Лише в Client Component. Для exceljs на кліку простіше `await import('exceljs')` (`bundle-conditional`) |
| `server-after-nonblocking` | `after()` для логування/аналітики | `03-api-reference/04-functions/after.md` — працює в Server Actions і Route Handlers | ✅ Використовуємо в скілах B і C; у фічі — через перенесення прогону B |

Що саме застосували і з якими числами — `docs/verification.md`, розділ Task A.

## 6. Закріплення версії й коміт

- Команда встановлення:
  ```bash
  DISABLE_TELEMETRY=1 npx skills@1.7.0 add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 \
    --skill vercel-react-best-practices -a claude-code --copy
  ```
  (Project scope; без `cursor` в `-a`, бо Cursor і так читає `.claude/skills/`.)
- Де лягли файли: `.claude/skills/vercel-react-best-practices/` — **справжні файли** (`--copy`), 75 штук, без `.agents/`.
- Що потрапило в git: тека скіла + `skills-lock.json` (джерело, тег, хеш).
- Як оновлювати: та сама команда з новим тегом → `git diff .claude/skills/vercel-react-best-practices` →
  рев'ю змін за цим чеклістом (особливо нові не-md файли, `allowed-tools`, хуки) → окремий коміт.

## Вердикт

**Встановити з умовами.** Ризик низький: скіл — лише markdown без скриптів, хуків, `allowed-tools` і прихованих
інструкцій, видавець — Vercel, ліцензія MIT, три аудити Pass (хоч і не прив'язані до нашого тега). Умови:
версія закріплена тегом і лежить у git справжніми файлами; кожну пораду перед застосуванням звіряємо з
`node_modules/next/dist/docs/` (частина порад у Next.js 16 зайва — `optimizePackageImports` для `recharts` уже
діє за замовчуванням — або ламає збірку — `ssr: false` у Server Component); оновлення — лише через повторне рев'ю діфу.
