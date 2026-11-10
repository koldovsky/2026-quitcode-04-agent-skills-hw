# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення (цей файл закомічено раніше за коміт зі скілом — видно в
> `git log`). Файли скіла читались як дані: неглибокий клон тега поза репозиторієм, нічого з нього
> не виконувалось і тека не відкривалась як проєкт в агенті.

**Дата, інструмент, ОС:** 10.11.2026 · Claude Code 2.1.308 (claude-opus-5-5) · macOS (Darwin 27.2), zsh · Node 24.15

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/vercel-labs/agent-skills> |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` (назва теки й `name` різні — CLI ставить у `.claude/skills/vercel-react-best-practices/`) |
| Версія | тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` → коміт `063bee94c3f4df8453406c830b0a7df0f2860278` (28.08.2026, реліз від `github-actions[bot]`) |
| Навіщо нам | клієнт скаржиться, що `/dashboard` відкривається понад 2 с; у команді немає експерта з продуктивності React/Next.js — скіл дає 70 правил з id, на які можна посилатися в комітах і власних скілах |

## 1. Подивитись, не встановлюючи

- Як дивились:
  - `DISABLE_TELEMETRY=1 npx skills@1.7.0 add "vercel-labs/agent-skills#agent-skills-063bee9…" --list` —
    CLI показав 10 скілів пакета з описами (`vercel-react-best-practices`, `vercel-composition-patterns`,
    `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize`, …); `git status` після цього — чистий;
  - `git clone --depth 1 --branch agent-skills-063bee9… https://github.com/vercel-labs/agent-skills.git
    ../review-agent-skills` (поза репозиторієм), `git rev-parse HEAD` → `063bee94c3f4…`.
- Склад скіла (76 файлів у клоні тега; CLI не копіює `metadata.json`, тож встановиться 75):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7,3 КБ | frontmatter + перелік 70 правил за 8 категоріями з id і пріоритетом |
  | `AGENTS.md` | 108 КБ (3810 рядків) | усі правила, скомпільовані в один документ |
  | `rules/*.md` | 72 файли, 292 КБ | 70 правил (по файлу на id) + `_sections.md`, `_template.md` |
  | `README.md` | 3,4 КБ | інструкція для мейнтейнерів (структура, `pnpm install`, збірка `AGENTS.md`) |
  | `metadata.json` | 0,9 КБ | версія, організація, анотація, посилання |

- Frontmatter `SKILL.md`: `name`, `description`, `license: MIT`, `metadata` (`author: vercel`,
  `version: "1.0.0"`). Немає `allowed-tools`, `hooks`, `context`, `disable-model-invocation`, `paths`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли | немає: усе `.md`, крім `metadata.json` | `find "$S" -type f ! -name "*.md"` → лише `metadata.json` |
| `allowed-tools` | немає | frontmatter (`awk '/^---$/{n++; next} n==1'`) |
| Команди під час рендеру `` !`cmd` `` | немає | `grep -rn '!\`' "$S"` → порожньо |
| Хуки, MCP-сервери, `plugin.json`, API-ключі | немає | `find "$S" -name "*hooks*.json" -o -name "*mcp*.json" -o -name "plugin.json" -o -name "settings*.json"` → порожньо |
| Інструкції агенту щось завантажити чи виконати | лише приклад `npx svgo --precision=1 --multipass icon.svg` у правилі `rendering-svg-precision` (і та сама копія в `AGENTS.md`); це порада для людини про оптимізацію SVG, не «завантаж і виконай»; у README — `pnpm install`/збірка для мейнтейнерів | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch"` |
| Посилання: куди ведуть | 35 унікальних URL: react.dev, nextjs.org, vercel.com/blog, developer.mozilla.org, github.com (isaacs/node-lru-cache, shuding/better-all), swr.vercel.app, esbuild/vite/webpack docs, csstriggers, jsfiddle, gist; `example.com` у прикладах коду. Немає «прочитай інструкції звідси» | `grep -rhoE "https?://…" \| sort -u` |
| Приховані інструкції | не знайдено: жодного «ignore previous»/«system prompt», HTML-коментарів, base64; 0 файлів з символами нульової ширини | `grep -rniE "ignore (all \|the )?previous\|system prompt\|<!--"`; node-скрипт із шаблону |

Висновок розділу: скіл — лише текст (інструкції й приклади коду). Він нічого не виконує сам і
не розширює дозволи агента. Залишковий ризик — поради, які агент застосує як код (див. розділ 5).

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen (Agent Trust Hub) | Pass, Risk Level: SAFE; єдина позначка — `INDIRECT_PROMPT_INJECTION` як «стандартний ризик для агентів, що обробляють код», не ознака зловмисності | 14.09.2026, 22:49 |
| Socket | Pass, без алертів (malicious behavior, security concerns, obfuscation, suspicious patterns) | 14.09.2026, 22:49 |
| Snyk | Pass, Risk Level: LOW, «No issues detected» | 14.09.2026, 22:48 |

- Де взяли: [skills.sh](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) і сторінки
  кожного аудиту (`…/security/agent-trust-hub`, `…/security/socket`, `…/security/snyk`).
- Чому CLI блок не показав: `--list` і встановлення запускались з `DISABLE_TELEMETRY=1` — з цією змінною
  CLI не завантажує аудити взагалі.
- До чого прив'язаний аудит: **не до нашого тега.** На сторінці skills.sh — лише «репозиторій + назва
  скіла» (команда встановлення без `#ref`); Socket показує хеш пакета
  `ca7b0c0c6e5f…a2506212` (sha256 вмісту, а не git SHA), Gen і Snyk — жодної версії. Аудит датований
  14.09, а наш тег — 28.08. Звірили історію: останній коміт, що змінював
  `skills/react-best-practices`, — `dc8367e6f9` від 14.04.2026, після тега змін у теці немає
  (`gh api …/commits?path=skills/react-best-practices&since=2026-08-28…` → порожньо). Тобто аудит
  фактично бачив той самий вміст, що й наш тег, — але це наш висновок, а не гарантія аудиту.

## 4. Ліцензія й походження

- Ліцензія: **MIT — лише у frontmatter `SKILL.md`** (`license: MIT`). Файлу `LICENSE` у корені
  репозиторію немає, GitHub ліцензію не визначає (`license: null` в API). Для внутрішнього використання
  в агенції достатньо, але це варто знати, якщо скіл колись розповсюджуватимемо далі.
- Видавець і активність: організація `vercel-labs` (Vercel). Репозиторій створено 08.12.2025, ~33,8 тис.
  зірок, ~3 тис. форків, останній push — 28.10.2026. Релізні теги ставить `github-actions[bot]`. На
  skills.sh: 886,5 тис. встановлень, First Seen 19.01.2026.

## 5. Чи правдивий зміст для нашого стеку

Звіряли з документацією Next.js 16.3.5 у `node_modules/next/dist/docs/`:

| Порада скіла (id) | Що каже скіл | Що каже документація нашої версії | Висновок |
|---|---|---|---|
| `async-parallel` | незалежні запити — `Promise.all()` | `01-app/01-getting-started/06-fetching-data.md`: паралельне завантаження даних, послідовні `await` — водоспад | ✅ застосовуємо (`/dashboard`) |
| `server-cache-react` | `React.cache()` для БД/авторизації; не передавати inline-об'єкти як аргумент | `06-fetching-data.md`: для доступу до даних не через `fetch` — `cache` з `react`; приклад з примітивним `id` | ✅ застосовуємо: `getWorkspace({ slug })` у нас якраз з inline-об'єктом (кеш завжди промахується), `getCurrentUser` без `cache` |
| `bundle-dynamic-imports` | приклад `dynamic(() => import(...), { ssr: false })` | `01-app/02-guides/lazy-loading.md`: «`ssr: false` is not allowed with `next/dynamic` in Server Components» — помилка збірки | ⚠️ лише в Client Component (у нас `leads-toolbar.tsx`); скопійований у `app/dashboard/page.tsx` приклад зламає `npm run build` |
| `bundle-barrel-imports` | додати `experimental.optimizePackageImports: ['lucide-react', '@mui/material']`; серед «уражених» — `lodash` | `05-config/01-next-config-js/optimizePackageImports.md`: `lucide-react`, `@mui/material`, `recharts` та ін. оптимізуються **за замовчуванням**; `lodash` (CommonJS) у списку немає, є лише `lodash-es` | ⚠️ конфіг з прикладу в 16.3.5 зайвий; для `lodash` потрібен прямий імпорт (`lodash/debounce`), а не прапорець |
| `server-after-nonblocking` | побічні ефекти — в `after()`; «працює в Server Actions, Route Handlers, Server Components» | `04-functions/after.md`: те саме + Proxy; «виконується навіть якщо відповідь не завершилась успішно — зокрема при `redirect`/`notFound`» | ✅ правдиво; у Task A не застосовуємо до виклику n8n (його контракт — Task C/D), лише беремо id для власних скілів |

## 6. Закріплення версії й коміт

- Команда встановлення (запускає людина у звичайному терміналі, не агент — агентський запуск вмикає
  `--yes`):
  `DISABLE_TELEMETRY=1 npx skills@1.7.0 add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 --skill vercel-react-best-practices -a claude-code --copy`,
  scope — **Project**.
- Де лягли файли; справжні файли чи посилання: _(допишу після встановлення)_
- Що потрапило в git: _(допишу після встановлення)_
- Як оновлювати: та сама команда з новим тегом → `git diff .claude/skills/vercel-react-best-practices skills-lock.json`
  → рев'ю змін за цим чеклістом (розділи 1–5) → окремий коміт `skills: bump vercel-react-best-practices to <тег>`.

## Вердикт

**Встановити з умовами.** Ризик низький: скіл — лише markdown без скриптів, хуків, MCP і
`allowed-tools`; видавець — Vercel; три незалежні аудити — Pass (хоч і не прив'язані до нашого тега,
вміст теки не змінювався з квітня 2026). Умови: тільки закріплений тег і `--copy` (справжні файли в git,
без `.agents/`); кожну пораду перед застосуванням звіряємо з `node_modules/next/dist/docs/` (особливо
`next/dynamic` з `ssr: false` і `optimizePackageImports`); у коміті кожного виправлення — id правила.
