# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення: цей файл закомічено окремим комітом раніше за коміт
> `skills: vendor vercel-react-best-practices …` — порядок видно в `git log --oneline`.
> Файли скіла читались як дані: з неглибокого клону поза репозиторієм, нічого з них не виконувалось,
> тека клону як проєкт в агенті не відкривалась.
>
> **Історія правок** (`git log -- docs/skill-review.md`). Рев'ю до встановлення — коміт `eaf292a`:
> розділи 1–5 і вердикт, а розділ 6 — заглушка «дописується після встановлення». Після нього файл змінювали так:
> - `3c354e2`, коміт встановлення. У розділі 3 перевірено, до якої версії прив'язаний аудит: `git ls-remote`,
>   звірка хешів. Це замінило припущення першої редакції «найімовірніше, інший стан `main`», і стара
>   фраза процитована в тексті. У розділі 4 прибрано здогад про автора коміту, замість нього — факт
>   (merge PR #328). Розділ 6 дописано після встановлення.
> - `77882b5`: у розділі 5 рядок `bundle-barrel-imports`. Для `lodash` порада не діє (виміряно, відкат
>   `e8c2cb5`).
> - `bd6ae06`: шляхи до файлів доказів після пакування в `summary.md`.
> - `2f61e6a`: ще один шлях і цей блок «Історія правок».
> - `103cf57`: у цьому блоці хеш замінено на новий після переписування історії; наступний коміт уточнив цей
>   перелік. Повний перелік — `git log -- docs/skill-review.md`.
>
> Вердикт і розділи 1–2 з часу `eaf292a` не змінювались.

**Дата, інструмент, ОС:** 27.09.2026 · Claude Code 2.1.282 · macOS (Darwin 25.6) + zsh · Node 22.21.0 · `skills@1.7.0`

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/vercel-labs/agent-skills> |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` (назва теки в джерелі ≠ `name`; CLI кладе скіл у теку за `name`) |
| Версія | release-тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` = коміт `063bee94c3f4df8453406c830b0a7df0f2860278` (28.08.2026, merge PR #328) — перевірено `git -C ../review-agent-skills rev-parse HEAD` |
| Навіщо нам | клієнт скаржиться на дашборд > 2 с і «форму, що думає»; експерта з продуктивності React у команді немає |

## 1. Подивитись, не встановлюючи

- Як дивились:
  1. `DISABLE_TELEMETRY=1 npx skills@1.7.0 add "vercel-labs/agent-skills#agent-skills-063bee9…" --list` —
     CLI показав 10 скілів пакета з описами; після цього `git status --short` у репозиторії порожній
     (CLI нічого не записав).
  2. `git clone --depth 1 --branch agent-skills-063bee9… https://github.com/vercel-labs/agent-skills.git ../review-agent-skills`
     — усі команди нижче виконано на цьому клоні (`S=../review-agent-skills/skills/react-best-practices`).
- Склад скіла (`find "$S" -type f | wc -l` → **76**; 72 файли в `rules/`):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7 251 Б | frontmatter + індекс 70 правил за 8 категоріями з id (`async-parallel`, `server-serialization`…) |
  | `AGENTS.md` | 108 261 Б | «скомпільований» повний текст усіх правил; `SKILL.md` відсилає до нього («For the complete guide… `AGENTS.md`») — ~27 тис. токенів, якщо агент прочитає цілком |
  | `rules/*.md` | 72 файли, 0,5–4,3 КБ | 70 правил + `_sections.md` і `_template.md` (службові) |
  | `README.md` | 3 360 Б | інструкція для мейнтейнерів (`pnpm install`, `pnpm build`), не для агента |
  | `metadata.json` | 921 Б | версія, організація, анотація; єдиний не-markdown файл. CLI його не копіює (звідси 75 замість 76) |

- Frontmatter `SKILL.md`: `name`, `description`, `license: MIT`, `metadata: {author: vercel, version: "1.0.0"}`.
  **Немає** `allowed-tools`, `hooks`, `context`, `disable-model-invocation`, `paths`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли | **немає** в теці скіла: єдиний не-`.md` файл — `metadata.json`. Скрипти збирання лежать поза скілом (`packages/react-best-practices-build/src/*.ts`) і з ним не встановлюються | `/usr/bin/find "$S" -type f ! -name "*.md"` → лише `metadata.json` |
| `allowed-tools` | **немає** | frontmatter через `awk` (вище) |
| Команди під час рендеру `` !`cmd` `` | **немає** | `grep -rn '!\`' "$S"` → 0 рядків |
| Хуки, MCP-сервери, `plugin.json`, API-ключі | **немає** | `find … -name "*hooks*.json" -o -name "*mcp*.json" -o -name plugin.json -o -name "settings*.json"` → 0; `grep -rniE "api[_-]?key"` → 0 |
| Інструкції агенту щось завантажити чи виконати | 2 збіги, обидва — приклад у правилі `rendering-svg-precision` (і його копія в `AGENTS.md:2477`): `npx svgo --precision=1 --multipass icon.svg`. Це порада розробнику оптимізувати SVG, а не інструкція агенту «запусти». Для нас неактуально (SVG у проєкті немає); якщо агент колись запропонує — це `npx` з мережі, лише після «так» людини (правило з `AGENTS.md` проєкту). `README.md` скіла каже `pnpm install` / `pnpm build` — для мейнтейнерів, посилається на `src/`, якої в теці скіла немає | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch" "$S"` |
| Посилання | 35 унікальних URL: `react.dev`, `nextjs.org`, `vercel.com/blog`, `swr.vercel.app`, `developer.mozilla.org`, GitHub-репозиторії бібліотек (`shuding/better-all`, `isaacs/node-lru-cache`), `example.com` у прикладах. Жодного «прочитай інструкції звідси» — лише довідкові посилання в кінці правил | `grep -rhoE "https?://…" "$S" \| sort \| uniq -c` |
| Приховані інструкції | **не знайдено**: 0 HTML-коментарів, 0 «ignore previous», 0 файлів з невидимими символами (U+200B–U+200F, U+2060, U+FEFF), 0 рядків, схожих на base64 (≥ 80 символів) | `grep -rniE "ignore (all \|the )?previous\|system prompt\|<!--"`; `node -e …` зі шаблону; `grep -rnoE '[A-Za-z0-9+/]{80,}={0,2}'` |

**Побічна знахідка:** `metadata.json` каже «Contains **40+** rules», `SKILL.md` — «Contains **70** rules». У
`rules/` справді 70 правил (72 файли мінус два службові). Анотація просто застаріла — дрібниця, але
показує, що метадані скіла ніхто не звіряє з вмістом.

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen (Agent Trust Hub) | **PASS**, Risk Level **SAFE**; одна примітка `INDIRECT_PROMPT_INJECTION`: скіл обробляє код користувача, тож це поверхня для непрямої ін'єкції, «не свідчить про зловмисний намір» | 14.09.2026, 22:49 |
| Socket | **PASS** (Malicious behavior, Security concerns, Code obfuscation, Suspicious patterns) | 14.09.2026, 22:49 |
| Snyk | **PASS**, Risk Level **LOW**, «No issues detected» | 14.09.2026, 22:48 |

- Де взяли: [skills.sh](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) і сторінки
  `…/security/agent-trust-hub`, `…/security/socket`, `…/security/snyk`.
- Чому CLI не показав блок: `--list` і встановлення запускались з `DISABLE_TELEMETRY=1` — з ним CLI
  аудити не завантажує. Крім того, встановлення запустив агент (на явне «так» людини в чаті), а в
  агентській сесії CLI сам вмикає `--yes` і не питає підтвердження. Тому аудити читались на skills.sh
  **до** встановлення, а цей файл закомічено раніше за встановлення.
- До чого прив'язаний аудит: сторінки skills.sh прив'язують аудит до пари «репозиторій + назва
  скіла» — **ні SHA, ні тега там немає**. Чи це наша версія, довелось встановлювати окремо:
  - `git ls-remote https://github.com/vercel-labs/agent-skills HEAD` → `063bee94…` — `main` **досі стоїть
    на нашому тезі** (останній push 28.08.2026), тож аудит від 14.09 бачив, найімовірніше, саме цей вміст.
    _Перша редакція цього рев'ю (коміт `eaf292a`) стверджувала протилежне — «найімовірніше, інший стан
    `main`». Це було припущення з дат, а не перевірка; виправлено після перевірки._
  - Хеш у Package URL Socket (`ca7b0c0c…2506212`) **не збігається** з `computedHash` у нашому
    `skills-lock.json` (`3219a194…c2357`). Контрольне встановлення поточного `main` у тимчасову теку поза
    репозиторієм дало той самий `3219a194…`, тобто вміст однаковий, а Socket рахує хеш іншим способом.
    Звірити аудит з нашою версією за хешем **неможливо**.
  - **Висновок:** аудит — сигнал про видавця й загальний характер скіла, але не заміна власного рев'ю
    саме цієї версії (розділи 1–2). Після наступного релізу аудит на skills.sh може стосуватися вже
    іншого вмісту, а сторінка цього не покаже.

## 4. Ліцензія й походження

- Ліцензія: **MIT**, заявлена у frontmatter `SKILL.md` (`license: MIT`) і в розділі «License» кореневого
  `README.md`. **Файлу `LICENSE` у репозиторії немає** — GitHub API повертає `"license": null`
  (`gh api repos/vercel-labs/agent-skills --jq .license`). Для MIT формально потрібен текст ліцензії з
  копірайтом; при вендорингу в клієнтський проєкт це ризик низький, але варто знати.
- Видавець і активність: організація `vercel-labs` (лабораторна організація Vercel на GitHub); останній
  коміт тега — merge PR #328 від 28.08.2026; репозиторій створено 08.12.2025, **31,6 тис. зірок**,
  2 767 форків, не архівований, останній push 28.08.2026; на skills.sh — **746,9 тис. встановлень**,
  «first seen» 19.01.2026. Релізи з тегом `agent-skills-<sha>` виходять кілька разів на тиждень
  (27.08, 28.08 …) — тобто вміст змінюється часто, і закріплення версії обов'язкове.

## 5. Чи правдивий зміст для нашого стеку

Звірено з документацією **Next.js 16.3.5** у `node_modules/next/dist/docs/` і з кодом `node_modules/next`.

| Порада скіла (id) | Що каже скіл | Що каже документація / код нашої версії | Висновок |
|---|---|---|---|
| `bundle-dynamic-imports` | приклад `dynamic(() => import(…), { ssr: false })` без жодного застереження, де його можна писати | `01-app/02-guides/lazy-loading.md:94`: «`ssr: false` option is not supported in Server Components. You will see an error…» | **Застосовувати лише в Client Component.** Скопійований у Server Component приклад ламає збірку |
| `bundle-barrel-imports` | налаштувати `experimental.optimizePackageImports: ['lucide-react', …]`; `lodash` — серед «commonly affected» | `dist/server/config.js:1122–1143`: Next.js 16 сам додає в цей список `lucide-react`, `lodash-es`, `recharts` та ін.; **`lodash` (CJS) у списку немає** (`grep -c "'lodash'"` → 0) | **Не діє в нашій версії — ні для `lucide-react`/`recharts`, ні для `lodash`.** _Перша редакція тут казала «для `lodash` порада актуальна» — я дивився лише на `optimizePackageImports`. Замір показав інше: після переходу на `lodash/debounce` клієнтський JS `/dashboard` — 587 212 Б **до і після** (`docs/evidence/task-a/summary.md`, розділи `05-…` / `06-…`). Причина — `dist/server/config.js:1117`: Next.js 16 має вбудований `modularizeImports` `lodash → lodash/{{member}}`, тобто вже переписує іменовані імпорти сам. Коміт відкочено (`e8c2cb5`)._ |
| `server-after-nonblocking` | «Works in Server Actions, Route Handlers, and Server Components»; приклад викликає `headers()`/`cookies()` **усередині** `after()` | `03-api-reference/04-functions/after.md:62–166`: усередині `after()` читати `headers`/`cookies` можна в Route Handlers і Server Functions, але **в Server Components — runtime-помилка** | приклад правильний лише для Route Handler / Server Action; у Server Component — читати заголовки до `after()` і передавати замиканням |
| `server-auth-actions` | Server Action — публічний ендпоінт, перевіряти сесію й права всередині | `02-guides/authentication.md:1463` і `data-security.md:291` кажуть те саме | **правдиво**, застосовуємо |
| `server-cache-react` | `React.cache()` для дедуплікації в межах запиту; уникати інлайн-об'єктів як аргументів | `02-guides/data-security.md:76` — той самий патерн `getCurrentUser = cache(…)` | **правдиво**; у `lib/data.ts` `getWorkspace` обгорнуто в `cache`, але викликається з інлайн-об'єктом `{ slug }` — саме той «always cache miss», про який пише правило |

## 6. Закріплення версії й коміт

- Команда встановлення (запустив агент на явне «так» людини в чаті; вивід — розділ `task-a/install.txt` у `docs/evidence/task-a/summary.md`):
  ```bash
  DISABLE_TELEMETRY=1 npx -y skills@1.7.0 add "vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278" \
    --skill vercel-react-best-practices -a claude-code --copy -y
  ```
  `-y` в агентській сесії CLI і так вмикає сам; scope — project (`-y` автовизначає project у git-репозиторії).
- Де лягли файли: `.claude/skills/vercel-react-best-practices/` — **75 справжніх файлів, 0 симлінків**
  (`find … -type f | wc -l` → 75, `find … -type l | wc -l` → 0); `.agents/` **немає**.
  `diff -rq ../review-agent-skills/skills/react-best-practices .claude/skills/vercel-react-best-practices` →
  одна різниця: `Only in ../review-agent-skills…: metadata.json`. Тобто встановлено **байт у байт** те,
  що рев'юїлось, мінус `metadata.json`.
- Що потрапило в git: тека скіла і `skills-lock.json`:
  `source: vercel-labs/agent-skills`, `ref: agent-skills-063bee94…`, `computedHash: 3219a1944e40…c2357`.
  `package.json` / `package-lock.json` не змінились.
- Як оновлювати: та сама команда з новим тегом → `git diff .claude/skills/vercel-react-best-practices skills-lock.json`
  → рев'ю змін за цим чеклістом (розділи 1–3 і 5 для нових чи змінених правил) → окремий коміт. Файли
  Vercel руками не правимо: чужий скіл оновлюється тегом.

## Вердикт

**Встановити з умовами.** Ризик низький: у скілі немає скриптів, хуків, `allowed-tools`, команд
під час рендеру, прихованих інструкцій і мережевих інструкцій агенту; видавець — Vercel, три аудити
PASS. Умови: (1) лише закріплений тег `agent-skills-063bee9…` з `--copy`, оновлення — новим тегом через
рев'ю діфу за цим чеклістом, а не правкою файлів; (2) кожну пораду перед застосуванням звіряти з
`node_modules/next/dist/docs/` — щонайменше три з п'яти перевірених порад у Next.js 16 треба
застосовувати з поправкою (`ssr: false`, `optimizePackageImports`, `headers()` в `after()`);
(3) аудит skills.sh не вважати аудитом нашої версії; (4) `npx svgo` та інші «запусти пакет» з правил —
лише після «так» людини.
