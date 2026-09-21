# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Еталонне виконання Task A (гілка `ws04/sample`). Рев'ю зроблено **до** встановлення, 21.09.2026:
> Windows 11 + Git Bash, Node 24.18.0, Claude Code 2.1.276, skills CLI 1.7.0.
> Нічого з чужих файлів не виконувалось; їхній текст читали як дані, не як інструкції.

## Що рев'юємо

| | |
|---|---|
| Репозиторій | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| Тека → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` (у `--skill` — саме `name`) |
| Версія | release-тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` = коміт `063bee9` від 28.08.2026 |
| Навіщо нам | ревʼю й виправлення продуктивності LeadDesk (Next.js 16.3.5, React 19.2.8) |

## 1. Подивитись, не встановлюючи

- `DISABLE_TELEMETRY=1 npx skills add "vercel-labs/agent-skills#agent-skills-063bee9…" --list` — CLI
  клонував тег і показав 9 скілів з описами; у репозиторій нічого не записав.
- Файли читали з окремого неглибокого клону **саме цього тега** (`git clone --depth 1 --branch
  agent-skills-063bee9… https://github.com/vercel-labs/agent-skills.git` у тимчасову теку), не з `main`.
- Склад скіла:

  | Файл | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7,4 КБ, 149 рядків | індекс 70 правил: id + один рядок; «читай `rules/<id>.md`» |
  | `rules/*.md` | 72 файли | 70 правил (`async-*`, `bundle-*`, `server-*` …) + `_sections.md`, `_template.md` |
  | `AGENTS.md` | 112 КБ, 3810 рядків | усі правила одним файлом (≈ 27 тис. токенів, якщо агент прочитає його цілком) |
  | `README.md`, `metadata.json` | | для мейнтейнерів |

- Frontmatter: `name`, `description`, `license: MIT`, `metadata` (`author: vercel`, `version: "1.0.0"`).
  Жодних полів Claude Code (`allowed-tools`, `hooks`, `context: fork`, `disable-model-invocation`).

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` чи інші виконувані файли | **немає** — лише `.md` і `metadata.json` | `find <skill> -type f ! -name "*.md"` |
| `allowed-tools` (попередній дозвіл на інструменти) | **немає** | frontmatter `SKILL.md` |
| Команди під час рендеру (`` !`cmd` ``) | **немає** | `grep '!\`'` |
| Інструкції агенту щось завантажити й виконати | **немає**. Одна команда-приклад для людини: `npx svgo --precision=1 --multipass icon.svg` у `rules/rendering-svg-precision.md` (і в `AGENTS.md`) | `grep -n "npx\|curl\|wget\|fetch"` |
| Посилання | 35 унікальних URL: react.dev, nextjs.org, vercel.com, github.com, npm, MDN, `example.com` у прикладах коду. Усі — довідкові, жодне не каже «завантаж ці інструкції» | `grep -o "https\?://…"` |
| Приховані інструкції | не знайдено: HTML-коментарів, «ignore previous…», «system prompt», zero-width символів, base64-блоків | `grep -i` за шаблонами + пошук U+200B–U+200F, U+2060, U+FEFF |

Для порівняння: сусідній `web-design-guidelines` із того самого репозиторію під час кожного запуску
тягне правила з `main` іншого репозиторію, а `deploy-to-vercel` запускає bash-скрипти, що пакують і
вивантажують проєкт. Такі скіли потребують значно суворішого рев'ю.

## 3. Аудити

- **CLI блок «Security Risk Assessments» не показав.** Причин дві, обидві — у коді skills CLI 1.7.0
  (`dist/cli.mjs`):
  1. в агентській сесії (Claude Code, Cursor) CLI сам вмикає `--yes` і не питає «Proceed with installation?»;
  2. `fetchAuditData()` повертає `null`, якщо задано `DISABLE_TELEMETRY` або `DO_NOT_TRACK`, —
     вимкнувши телеметрію, ви вимикаєте й показ аудитів.
- Ті самі дані отримали напряму (`GET https://add-skill.vercel.sh/audit?source=vercel-labs/agent-skills&skills=vercel-react-best-practices`)
  і на [skills.sh](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices):

  | Аудит | Результат | Дата аналізу |
  |---|---|---|
  | Gen (ATH) | Safe | 14.09.2026 |
  | Socket | Safe, 0 alerts, score 90 | 14.09.2026 |
  | Snyk | Low Risk | 14.09.2026 |
  | ZeroLeaks (CLI не показує) | Safe, score 93 | 15.04.2026 |

- Застереження: аудит прив'язаний до пари «репозиторій + назва скіла», **а не до закріпленого тега**.
  Він не гарантує, що перевірено саме наш коміт, — тому власне рев'ю вище обов'язкове.

## 4. Ліцензія й походження

- `license: MIT` у frontmatter і розділ «License: MIT» у README репозиторію. **Файлу `LICENSE` у корені
  немає** (перевірено в клоні тега), тож GitHub ліцензію не показує. Для внутрішнього використання
  прийнятно; для юриста — зафіксувати, що ліцензія заявлена лише текстом.
- Видавець — організація `vercel-labs` (Vercel), `metadata.author: vercel`; скіл широко вживаний
  (skills.sh показує сотні тисяч встановлень).
- `metadata.json` застарів: «40+ rules», «January 2026», `version 1.0.0`, хоча правил 70 (72 файли в
  `rules/` мінус два службові). Ризику не несе, але це сигнал: метадані скіла не перевіряються.

## 5. Чи правдивий зміст для нашого стеку

Скіл писався не під конкретну версію Next.js. Звірили правила, які застосовували, з документацією
Next.js 16.3.5 (`node_modules/next/dist/docs/`) і з вимірюваннями:

1. **`bundle-barrel-imports`**: приклади — `lucide-react` і `@mui/material` з порадою додати їх в
   `optimizePackageImports`. У Next.js 16.3.5 обидва вже в списку за замовчуванням. Більше того, імпорти
   з `lodash` Next.js сам переписує на `lodash/<member>` (`modularizeImports` у
   `next/dist/server/config.js`): на `main` lodash займав у клієнтському JS `/dashboard` лише **2,6 КБ**.
   Буквальне виконання правила дало б зміни без ефекту.
2. **`bundle-dynamic-imports`**: приклад використовує `ssr: false`, а в Server Component це помилка збірки.
   Ми лишили `next/dynamic` у клієнтському `leads-toolbar.tsx`.
3. **`client-swr-dedup`** радить SWR. У нашому випадку дані вже були на сервері, тож кращим виправленням
   стали пропси з серверної сторінки — без нової залежності.
4. **`server-after-nonblocking`** збігається з документацією 16.3.5: `after()` працює в Server Functions і
   Route Handlers, `headers()`/`cookies()` усередині `after()` дозволені там, але не в Server Components.
5. **Обсяг**: `SKILL.md` відсилає до окремих `rules/<id>.md` — добре для контексту. Ризик — агент читає
   `AGENTS.md` (112 КБ) цілком.

## 6. Закріплення версії й коміт

- Команда встановлення (фінальна):
  ```bash
  DISABLE_TELEMETRY=1 npx skills add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 \
    --skill vercel-react-best-practices -a claude-code --copy
  ```
- **Чому `--copy` і лише `-a claude-code`** (перевірено на цій машині):
  - режим за замовчуванням кладе файли в `.agents/skills/`, а `.claude/skills/<name>` робить
    **junction** на Windows (з абсолютним шляхом `D:\…`). Git for Windows (`core.symlinks=false`) не
    бачить у ньому посилання й комітить **другу повну копію** (150 файлів замість 75): клон працює, але
    дві копії розходяться після оновлення, а Cursor бачить скіл двічі;
  - на macOS/Linux той самий режим робить відносний symlink — у клоні на Windows він стане текстовим
    файлом, і Claude Code скіла не побачить (з коду CLI; на macOS не перевіряли);
  - `-a … cursor` навіть із `--copy` додає ще одну копію в `.agents/skills/`. Cursor читає і
    `.claude/skills/`, тож однієї копії досить.
- Перевірено: вміст `.claude/skills/vercel-react-best-practices/` (75 файлів) побайтно збігається з
  тегом (`diff -r --strip-trailing-cr`); CLI не копіює лише `metadata.json`. Коміт `287e4f1`; свіжий
  `git clone` на Windows дає звичайну теку з читабельним `SKILL.md`.
- `skills-lock.json` закомічено (source, ref, `computedHash`). Відновлення з нього
  (`npx skills experimental_install`) пише лише в `.agents/skills/`, яку Claude Code не читає, — тому
  справжні файли лежать у git.
- Оновлення: та сама команда з новим тегом → `git diff .claude/skills/vercel-react-best-practices` →
  рев'ю змін за цим чеклістом → коміт.

## Вердикт

**Встановити — так.** Ризик низький: лише markdown, без скриптів, мережевих інструкцій і
`allowed-tools`; аудити чисті; видавець відомий; ліцензія MIT заявлена (без файлу `LICENSE`).
Умови: закріплений тег, `--copy`, справжні файли в git, і кожна порада звіряється з документацією нашої
версії Next.js (див. розділ 5).

## Що скіл дав у LeadDesk

Кожне виправлення — окремий коміт з id правила. Числа — продакшн-збірка (`next build` + `next start`),
до = `main` (`ea73649`), після = `ws04/sample`; метод і сирі дані — `docs/verification.md`.

| Правило | Коміт | Було (`main`) | Стало (`ws04/sample`) |
|---|---|---|---|
| `async-parallel` + `async-suspense-boundaries` | `869868d`, `d0835e3` | `/dashboard`: перший байт 2266–2277 мс, уся сторінка 2270–2281 мс | перший байт 645–648 мс (оболонка стрімиться), уся сторінка 1438–1440 мс |
| `server-cache-react` | `7ae39b3` | на запит: `getUserBySession` ×3, `getWorkspace` ×3 | ×1, ×1 |
| `server-serialization` | `665d3b3` | HTML 424,6 КБ, RSC 315,2 КБ; `internalNotes`, `rawPayload`, `ipAddress` у браузері | HTML 121,2 КБ, RSC 38,8 КБ; внутрішніх полів немає |
| `bundle-dynamic-imports`, `bundle-conditional` | `98855f7` | початковий JS `/dashboard` 1828 КБ (526 КБ gzip); exceljs і recharts у чанку, який HTML вантажить одразу | 571 КБ (177 КБ gzip); exceljs (909 КБ) і recharts (350 КБ) — окремі чанки, вантажаться за кліком |
| `server-after-nonblocking` | `80a8edf` | відправка форми ліда проти мока n8n (2 с): 2403–2428 мс | 130–156 мс |
| `server-auth-actions` | `de5861f` | `updateLeadStatus` напряму: користувач іншого workspace і довільна cookie змінюють статус | статус не змінюється |
| `client-swr-dedup` | `c407706` | пошук робив окремий `fetch("/api/leads")` після завантаження | рядки приходять пропсами (за кодом: запиту більше немає) |
| `rerender-derived-state-no-effect` | `558014e` | фільтр у другому `useEffect` через debounce lodash | збіги рахуються під час рендеру (`useDeferredValue`); lodash видалено |
