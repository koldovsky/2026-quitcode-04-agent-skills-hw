# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення. Файли скіла читали як дані: нічого з них не виконували, теку
> скіла як проєкт в агенті не відкривали.

**Дата, інструмент, ОС:** 24.09.2026 · Claude Code 2.1.252 (Opus 5.5) · macOS 15 (Darwin 24.6) + zsh · Node 24.21

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/vercel-labs/agent-skills> |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` |
| Версія | тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` = коміт `063bee94c3f4df8453406c830b0a7df0f2860278` (28.08.2026) |
| Навіщо нам | клієнт скаржиться, що `/dashboard` відкривається > 2 с; експерта з продуктивності React у команді немає — беремо правила Vercel як довідку для рев'ю й виправлень |

## 1. Подивитись, не встановлюючи

- Як дивились:
  - `DISABLE_TELEMETRY=1 npx skills@1.7.0 add "vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278" --list` —
    CLI показав 10 скілів репозиторію з описами (серед них `vercel-react-best-practices`); `git status` після цього — чистий, `.claude/` і `.agents/` не з'явились.
  - `git clone --depth 1 --branch agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 https://github.com/vercel-labs/agent-skills.git ../review-agent-skills` —
    неглибокий клон **поза** репозиторієм; `git log -1` → `063bee94… 2026-08-28 Aurora Scharff`.
- Склад скіла (76 файлів у клоні тега; CLI не копіює `metadata.json`, тож після встановлення очікуємо 75):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7,3 КБ | frontmatter + перелік 8 категорій і id правил за пріоритетом, «читай `rules/<id>.md`» |
  | `rules/` | 72 файли, ~292 КБ | 70 правил (`async-*`, `bundle-*`, `server-*`, `client-*`, `rerender-*`, `rendering-*`, `js-*`, `advanced-*`) + `_sections.md`, `_template.md` |
  | `AGENTS.md` | 108 КБ | усі правила, зібрані в один документ |
  | `README.md` | 3,4 КБ | як влаштований скіл і як додавати правила |
  | `metadata.json` | 0,9 КБ | версія 1.0.0, організація, анотація, список посилань (CLI його не копіює) |

- Frontmatter `SKILL.md`: `name`, `description`, `license: MIT`, `metadata` (`author: vercel`, `version: "1.0.0"`).
  **Немає** `allowed-tools`, `hooks`, `context`, `model`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли (`.sh`, `.mjs`, `.py`…) | Немає. Єдиний не-markdown файл — `metadata.json` (дані) | `find "$S" -type f ! -name "*.md"` |
| `allowed-tools` — попередній дозвіл на інструменти | Немає | `awk '/^---$/{n++; next} n==1' "$S/SKILL.md"` |
| Команди під час рендеру `` !`cmd` `` | Немає (0 збігів) | `grep -rn '!`' "$S"` |
| Хуки, MCP-сервери, `plugin.json`, вимога API-ключів | Немає (0 файлів), ключів не вимагає | `find "$S" -name "*hooks*.json" -o -name "*mcp*.json" -o -name "plugin.json" -o -name "settings*.json"` |
| Інструкції агенту щось завантажити чи виконати | 2 збіги: `npx svgo --precision=1 --multipass icon.svg` у `rules/rendering-svg-precision.md:27` і той самий приклад у `AGENTS.md:2477`. Це приклад команди для розробника (оптимізація SVG), а не інструкція агенту виконати її; `curl`/`wget`/`WebFetch` — немає | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch" "$S"` |
| Посилання: куди ведуть, чи є «прочитай інструкції звідси» | 35 унікальних URL: react.dev, nextjs.org, vercel.com (блог, docs), MDN, esbuild, webpack, vite, npm, GitHub (`isaacs/node-lru-cache`, `shuding/better-all`), gist, jsfiddle, x.com; плюс заглушки `example.com`. Усі — довідкові посилання «див. також»; жодного «завантаж / прочитай інструкції звідси» | `grep -rhoE "https?://…" "$S" \| sort -u` |
| Приховані інструкції: HTML-коментарі, «ignore previous…», невидимі символи, base64 | Немає: 0 збігів на `ignore previous` / `system prompt` / `<!--`; 0 файлів з символами нульової ширини | `grep -rniE …`; node-скрипт з шаблону |

Висновок розділу: скіл — лише текст (markdown), нічого не виконує й нічого не завантажує сам.
Єдиний реальний ризик — непряма prompt-інʼєкція через код, який агент читає під час рев'ю (так само
оцінює Gen, див. нижче), і застарілі чи невідповідні для Next.js 16 поради (розділ 5).

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen Agent Trust Hub | Pass · Risk Level: SAFE (зауваження: `INDIRECT_PROMPT_INJECTION` — поверхня через код користувача, який скіл рев'ює) | 14.09.2026 |
| Socket | Pass (malicious behavior, security concerns, obfuscation, suspicious patterns — без знахідок) | 14.09.2026, 22:49 |
| Snyk | Pass · Risk Level: LOW, «No issues detected» | 14.09.2026, 22:48 |

- Де взяли: <https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices> → розділ Security Audits і сторінки
  `…/security/agent-trust-hub`, `…/security/socket`, `…/security/snyk` (також: 741K встановлень, 31,5K зірок, «first seen» 19.01.2026).
- Чому CLI не показав блок: запускали з `DISABLE_TELEMETRY=1` — з цією змінною (або `DO_NOT_TRACK=1`) CLI аудити не завантажує
  взагалі. До того ж CLI, запущений з агентської сесії, сам вмикає `--yes`: навіть якби блок з'явився, встановлення не чекало б
  підтвердження. Тому аудити читали на skills.sh, а встановлення запускаємо самі, у звичайному терміналі.
- До чого прив'язаний аудит: **не до нашого тега.** Сторінки прив'язані до «репозиторій + назва скіла» і показують аналіз на
  14.09.2026 — тобто того вмісту, що був у репозиторії на ту дату (наш тег — 28.08.2026). Socket вказує хеш вмісту
  (`…vercel-react-best-practices/@ca7b0c0c…`), а не тег чи коміт, тож співставити аудит із нашою версією напряму не можна.
  Аудит — сигнал про репутацію, а не заміна власної перевірки саме нашої версії (розділи 1–2).

## 4. Ліцензія й походження

- Ліцензія: **MIT** — заявлена у frontmatter `SKILL.md` (`license: MIT`) і в розділі «License» кореневого `README.md`.
  Окремого файлу `LICENSE` у репозиторії немає, і GitHub ліцензію не розпізнає (`license: null` в API) — для MIT це
  прийнятно, але варто знати: текст ліцензії з копірайтом формально ніде не лежить.
- Видавець і активність: організація `vercel-labs` (експериментальна організація Vercel), автор у metadata — Vercel Engineering.
  Репозиторій створено 08.12.2025, останній push — 28.08.2026 (той самий коміт, що й наш тег); 31,5K зірок, 2,7K форків,
  741K встановлень на skills.sh.

## 5. Чи правдивий зміст для нашого стеку

Звіряємо з `node_modules/next/dist/docs/` (Next.js 16.3.5) під час виправлень (Task A, крок 5).

| Порада скіла (id) | Що каже скіл | Що каже документація нашої версії | Висновок |
|---|---|---|---|
| `async-parallel` | незалежні async-операції — через `Promise.all()` | `01-app/01-getting-started/06-fetching-data.md` → «Parallel data fetching»: layouts і pages рендеряться паралельно, але `await` підряд усередині компонента — послідовні; приклад з `Promise.all` | Правдиво для 16.3.5. Застосовано (`95498a0`): 2.24 → 1.43 с. Ланцюжок user → workspace лишили послідовним — він справді залежний |
| `server-cache-react` | `React.cache()` для дедуплікації запитів у межах одного запиту; не передавати inline-об'єкти (`Object.is`) | `01-app/02-guides/caching-without-cache-components.md`: для ORM/БД (не `fetch`) — обгорнути доступ до даних у React `cache`; `02-guides/data-security.md`: кешований `getCurrentUser` з `cookies()` | Правдиво. Застосовано (`f823608`): 3 → 1 запит user/workspace. `cacheComponents` у `next.config.ts` не ввімкнено, тож `'use cache'` тут не альтернатива |
| `bundle-dynamic-imports` | `next/dynamic` з `{ ssr: false }` для важких компонентів | `01-app/02-guides/lazy-loading.md`: `ssr: false` заборонено в Server Components; code splitting не працює, коли Server Component динамічно імпортує Client Component; зовнішні бібліотеки — через `import()` в обробнику | Частково: приклад скіла без цих застережень у Server Component зламає збірку. Застосовувати лише в клієнтському `leads-toolbar.tsx`. У Task A не застосовано |

## 6. Закріплення версії й коміт

- Команда встановлення (запускаємо самі, у звичайному терміналі, scope **Project**):
  `DISABLE_TELEMETRY=1 npx skills@1.7.0 add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 --skill vercel-react-best-practices -a claude-code --copy`
- Де лягли файли; справжні файли чи посилання: `.claude/skills/vercel-react-best-practices/` — 75 справжніх файлів
  (`find .claude -type l` — порожньо), `.agents/` не створено. `diff -rq` з клоном тега: відрізняється лише відсутній
  `metadata.json` — тобто встановлено рівно той вміст, який ми рев'ювали.
- Що потрапило в git: тека скіла й `skills-lock.json` (`source: vercel-labs/agent-skills`,
  `ref: agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278`, `computedHash: 3219a194…2357`).
- Як оновлювати: та сама команда з новим тегом → `git diff .claude/skills/vercel-react-best-practices skills-lock.json` →
  рев'ю змін за цим чеклістом (розділи 1–3) → коміт.

## Вердикт

**Встановити з умовами.** Ризик низький: скіл — лише markdown, без скриптів, `allowed-tools`, хуків, MCP і команд під час
рендеру; посилання довідкові; прихованих інструкцій немає; три незалежні аудити — Pass. Умови: версія закріплена тегом
(`#agent-skills-063bee9…`), справжні файли (`--copy`) у git разом із `skills-lock.json`; кожну пораду перед застосуванням
звіряємо з документацією Next.js 16.3.5; оновлення — лише через повторне рев'ю діфу.
