# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення. Файли скіла читались як дані в неглибокому клоні тега поза
> репозиторієм (`../review-agent-skills`); нічого з них не виконувалось.

**Дата, інструмент, ОС:** 27.09.2026 · Claude Code (desktop, Opus 5.5) · Windows 11 Pro + Git Bash · Node 23.4.0

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/vercel-labs/agent-skills> |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` |
| Версія | тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` (коміт `063bee94c3f4df8453406c830b0a7df0f2860278`, 28.08.2026) |
| Навіщо нам | клієнт скаржиться, що `/dashboard` відкривається > 2 с, а форма «думає»; експерта з продуктивності React у команді немає — беремо 70 правил Vercel як чекліст для рев'ю й виправлень |

## 1. Подивитись, не встановлюючи

- Як дивились:
  - `DISABLE_TELEMETRY=1 npx skills@1.7.0 add "vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278" --list` — 9 скілів у паку, серед них `vercel-react-best-practices`; `git status` після цього — чисто, у репозиторій нічого не записано;
  - `git clone --depth 1 --branch agent-skills-063bee9… https://github.com/vercel-labs/agent-skills.git ../review-agent-skills` — пошук командами з шаблону.
- Склад скіла (76 файлів, 418 KB; CLI скопіює 75 — без `metadata.json`):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7,4 KB | frontmatter + індекс 70 правил за 8 категоріями й пріоритетом |
  | `AGENTS.md` | 112 KB | усі правила, зібрані в один документ |
  | `README.md` | 3,5 KB | опис для людей, як збирати `AGENTS.md` |
  | `rules/*.md` | 72 файли | 70 правил (`async-*`, `bundle-*`, `server-*`, `client-*`, `rerender-*`, `rendering-*`, `js-*`, `advanced-*`) + `_sections.md`, `_template.md` |
  | `metadata.json` | 0,9 KB | версія 1.0.0, автор, список посилань; у встановлення не потрапляє |

- Frontmatter `SKILL.md`: `name`, `description`, `license: MIT`, `metadata` (`author: vercel`, `version: "1.0.0"`). Полів `allowed-tools`, `hooks`, `context`, `model` **немає**.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли | Немає. Єдиний не-markdown файл — `metadata.json` (дані) | `find "$S" -type f ! -name "*.md"` |
| `allowed-tools` | Немає — скіл не отримує попередніх дозволів на інструменти | frontmatter через `awk` |
| Команди під час рендеру `` !`cmd` `` | Немає | `grep -rn '!\`' "$S"` — 0 збігів |
| Хуки, MCP-сервери, `plugin.json`, API-ключі | Немає | `find` за `*hooks*.json`, `*mcp*.json`, `plugin.json`, `settings*.json` — 0 |
| Інструкції агенту щось завантажити чи виконати | Лише приклад `npx svgo --precision=1 --multipass icon.svg` у правилі `rendering-svg-precision` (і його копія в `AGENTS.md`) — порада розробнику, як оптимізувати SVG, а не команда агенту виконати її зараз. `curl`/`wget`/`WebFetch` — немає | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch"` |
| Посилання | 35 унікальних URL: react.dev, nextjs.org, vercel.com (блог, docs), MDN, swr.vercel.app, GitHub (`isaacs/node-lru-cache`, `shuding/better-all`), esbuild/vite/webpack docs, `example.com` у прикладах коду. Жодного «прочитай/завантаж інструкції звідси» | `grep -rhoE "https?://…" \| sort -u` |
| Приховані інструкції | HTML-коментарів, «ignore previous», «system prompt» — немає; файлів із zero-width символами — 0; довгих base64-рядків — немає | `grep -rniE`, node-скрипт з шаблону, `grep -rnoE "[A-Za-z0-9+/]{80,}"` |

**Підсумок:** скіл — лише текст (markdown). Виконуваного коду, дозволів, хуків і мережевих дій немає.
Ризик — у змісті порад (див. пункт 5), а не у виконанні.

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen (Agent Trust Hub) | PASS · Risk Level SAFE (позначка `INDIRECT_PROMPT_INJECTION` — лише як «поверхня»: скіл читає код користувача) | 14.09.2026 |
| Socket | PASS · malicious behavior / security concerns / obfuscation / suspicious patterns — чисто | 14.09.2026 |
| Snyk | PASS · Risk Level LOW, «No issues detected» | 14.09.2026 |

- Де взяли: [skills.sh](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) → сторінки `/security/agent-trust-hub`, `/security/socket`, `/security/snyk`.
- Чому CLI не показав блок: команду `--list` запускали з `DISABLE_TELEMETRY=1` — з нею CLI аудити не завантажує. Крім того, у сесії агента CLI сам вмикає `--yes`, тому встановлення запускаємо самі у звичайному терміналі.
- До чого прив'язаний аудит: до **«репозиторій + назва скіла»** (поточний стан `main`), а не до нашого тега — Socket вказує хеш вмісту `@ca7b0c0c…`, а не коміт `063bee9`. Щоб зрозуміти, чи аудит стосується нашої версії, перевірили історію теки: останній коміт у `skills/react-best-practices` — `dc8367e` від 14.04.2026, тобто задовго до тега (28.08.2026) і аудиту (14.09.2026). Отже вміст тега = вміст, який аудитували. При оновленні тега цей висновок треба перевіряти заново.

## 4. Ліцензія й походження

- Ліцензія: **MIT**, заявлена лише у frontmatter `SKILL.md` (`license: MIT`). Файлу `LICENSE` у корені репозиторію немає (GitHub API: `license: null`, `/contents/LICENSE` → 404). Для внутрішнього використання в клієнтському проєкті прийнятно, але варто знати: юридично ліцензія задекларована лише в одному полі.
- Видавець і активність: організація `vercel-labs` (офіційна лабораторна організація Vercel), `metadata.author: vercel`. Репозиторій створено 08.12.2025, ~31,6K зірок, останній push — 28.08.2026. На skills.sh — 747,5K встановлень, first seen 19.01.2026.

## 5. Чи правдивий зміст для нашого стеку

Звіряли з `node_modules/next/dist/docs/` (Next.js 16.3.5) перед застосуванням:

| Порада скіла (id) | Що каже скіл | Що каже документація нашої версії | Висновок |
|---|---|---|---|
| `async-parallel` | незалежні `await` — через `Promise.all()` | `01-app/01-getting-started/06-fetching-data.md`, «Parallel data fetching»: layouts і pages рендеряться паралельно, але `await` підряд усередині компонента — послідовні; приклад з `Promise.all` | Правдива. Застосовано (коміт `6d3b885`), TTFB 2,27 → 1,45 с |
| `server-cache-react` | `React.cache()` для дедуплікації в межах запиту; не передавати inline-об'єкти як аргументи (`Object.is`) | `06-fetching-data.md` (`cache` з `react` для `getUser`) і `02-guides/data-security.md` (`getCurrentUser = cache(async () => { await cookies() … })`) — той самий патерн | Правдива, включно з `cookies()` усередині `cache`. Застосовано (коміт `a6385fb`), запити до БД 3 → 1 |
| `server-serialization` | передавати в Client Component лише поля, які він використовує | `02-guides/data-security.md`: «Return safe, minimal Data Transfer Objects (DTOs)»; Taint API — лише додатковий захист, фільтрувати треба в DAL | Правдива. Застосовано (коміт `ebff140`), HTML 424 → 111 КБ, `rawPayload`/нотатки/IP більше не в браузері |
| `bundle-barrel-imports` | додати бібліотеки в `experimental.optimizePackageImports` (Next.js 13.5+) | `03-api-reference/05-config/01-next-config-js/optimizePackageImports.md`: `recharts` і `lodash-es` оптимізуються **за замовчуванням**; `lodash` (CJS) у списку немає | Частково застаріла: для `recharts` конфіг зайвий; для `lodash` конфіг не допоможе — потрібен прямий імпорт `lodash/debounce`. Не застосовано |
| `server-auth-actions` | перевіряти автентифікацію всередині кожної Server Action, «do not rely solely on middleware» | `02-guides/upgrading/version-16.md` §«`middleware` to `proxy`»: `middleware` застарів і перейменований на `proxy`; `01-getting-started/07-mutating-data.md`: Server Functions доступні прямим POST | Суть правдива, термін застарів (у нас — `proxy.ts`, і він перевіряє лише наявність cookie). Знайдено в `app/actions.ts:68-77` |
| `server-parallel-fetching` | «RSC execute sequentially within a tree» | `06-fetching-data.md:460`: layouts і pages рендеряться паралельно; послідовні — лише `await` усередині одного компонента | Неточне. Підтвердили заміром: дублікати в layout/header/page не додавали часу (див. `server-cache-react` у `docs/verification.md`) |

## 6. Закріплення версії й коміт

- Команда встановлення (запускаємо самі, у звичайному терміналі, scope → Project):
  ```bash
  DISABLE_TELEMETRY=1 npx skills@1.7.0 add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 \
    --skill vercel-react-best-practices -a claude-code --copy
  ```
- Де лягли файли; справжні файли чи посилання: `.claude/skills/vercel-react-best-practices/` — справжні файли (`--copy`), без `.agents/skills/` і без junction.
- Що потрапило в git: тека скіла (75 файлів) і `skills-lock.json` (джерело, тег, хеш).
- Побічний ефект, знайдений після встановлення: у `~/.claude/skills/` з'явився **особистий** скіл `find-skills` (час створення — 27.09.2026 20:44, збігається з запуском `npx skills@1.7.0 add`; інших особистих скілів там немає). Його опис — знаходити й **встановлювати** скіли з екосистеми. Свіжа сесія бачить його як `User`. Висновок: CLI може змінювати не лише проєкт, а й особисті налаштування агента — після кожного `npx skills` перевіряти `~/.claude/skills/`; перед Task D цей скіл прибрати.
- Як оновлювати: та сама команда з новим тегом → `git diff .claude/skills/vercel-react-best-practices` → рев'ю змін за цим чеклістом (і перевірка, до якої версії прив'язаний аудит) → окремий коміт.

## Вердикт

**Встановити з умовами.** Скіл — лише markdown без скриптів, `allowed-tools`, хуків і мережевих
дій, три аудити — PASS, видавець — Vercel. Ризик низький і полягає в змісті: правила не прив'язані
до версії Next.js, тож кожну пораду перед застосуванням звіряємо з `node_modules/next/dist/docs/`
(Next.js 16.3.5). Умови: лише закріплений тег і `--copy`; оновлення — тільки через повторне рев'ю;
команди з прикладів (`npx svgo …`) агент без запиту не виконує.
