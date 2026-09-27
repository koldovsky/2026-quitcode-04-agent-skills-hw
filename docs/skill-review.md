# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення: цей файл закомічено окремим комітом раніше, ніж коміт
> `skills: vendor vercel-react-best-practices …` (див. `git log --oneline -- docs/skill-review.md .claude/skills`).
> Файли скіла читались як дані з неглибокого клону поза репозиторієм; клон не відкривався як
> проєкт в агенті, нічого з нього не виконувалось.

**Дата, інструмент, ОС:** 27.09.2026 · Claude Code 2.1.168 (desktop, модель Opus 5.5) · macOS (Darwin 25.5), zsh

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/vercel-labs/agent-skills> |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` (назва теки в джерелі **не** збігається з `name`; CLI кладе скіл у теку за `name`, тож у нас `name` = тека) |
| Версія | тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` → коміт `063bee94c3f4df8453406c830b0a7df0f2860278` (28.08.2026, Aurora Scharff); тег вказує прямо на коміт (`type: commit`) |
| Навіщо нам | клієнт скаржиться на повільний дашборд (> 2 с) і «задумливу» форму; експерта з продуктивності React у команді немає |

## 1. Подивитись, не встановлюючи

- Як дивились:
  1. `DISABLE_TELEMETRY=1 npx skills@1.7.0 add "vercel-labs/agent-skills#agent-skills-063bee9…" --list` —
     CLI показав 11 скілів пакета з описами, у репозиторій нічого не записав;
  2. `git clone --depth 1 --branch agent-skills-063bee9… https://github.com/vercel-labs/agent-skills.git ../review-agent-skills`
     (поза робочим репозиторієм), `git rev-parse HEAD` = `063bee94c3f4…`;
  3. команди-підказки з шаблону (нижче — результати).
- Склад скіла (у клоні тега — 76 файлів):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7,3 КБ | frontmatter + перелік 70 правил за 8 категоріями з id і пріоритетом |
  | `AGENTS.md` | 108 КБ | зібраний документ з усіма правилами (генерується з `rules/`) |
  | `README.md` | 3,4 КБ | як підтримувати правила (`pnpm build/validate` — стосується репозиторію-джерела, не нас) |
  | `metadata.json` | 0,9 КБ | версія, організація, дата «January 2026», посилання. CLI його не копіює (тому встановлених файлів 75) |
  | `rules/*.md` | 72 файли | по одному правилу + `_sections.md`, `_template.md` |

- Frontmatter `SKILL.md`: `name`, `description`, `license: MIT`, `metadata` (`author: vercel`, `version: "1.0.0"`).
  **Немає** `allowed-tools`, `hooks`, `context`, `model`, `disable-model-invocation`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли (`.sh`, `.mjs`, `.py`…) | Немає. Єдиний не-markdown файл — `metadata.json` (дані) | `find "$S" -type f ! -name "*.md"` |
| `allowed-tools` | Відсутнє: скіл не дає собі попередніх дозволів на інструменти | frontmatter через `awk` |
| Команди під час рендеру `` !`cmd` `` | 0 збігів | `grep -rn '!\`' "$S"` |
| Хуки, MCP-сервери, `plugin.json`, API-ключі | Немає жодного такого файлу, вимог ключів немає | `find … -name "*hooks*.json" -o -name "*mcp*.json" -o -name plugin.json -o -name "settings*.json"` → порожньо |
| Інструкції агенту щось завантажити чи виконати | 2 збіги, обидва — той самий приклад `npx svgo --precision=1 --multipass icon.svg` у правилі `rendering-svg-precision` (і в `AGENTS.md`). Це порада розробнику оптимізувати SVG, а не інструкція агенту виконати її зараз. У нас SVG-іконок немає, правило не застосовуємо | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch"` |
| Посилання: куди ведуть | 35 унікальних URL: react.dev, nextjs.org, vercel.com (блог і доки), MDN, GitHub (`isaacs/node-lru-cache`, `shuding/better-all`), swr.vercel.app, esbuild, vite, webpack, npm, jsfiddle, gist, x.com, `*.example.com` у прикладах. Жодного «прочитай інструкції звідси» — це посилання-джерела | `grep -rhoE "https?://…" \| sort -u` |
| Приховані інструкції | `ignore previous` / `system prompt` / `<!--` — 0 збігів; невидимих символів нульової ширини — 0 файлів; base64-блоків не видно | `grep -rniE …` і node-однорядник з шаблону |

Два правила радять **нові залежності**: `async-dependencies` (`better-all`) і `server-cache-lru`
(`lru-cache`). Самі по собі вони нічого не встановлюють, але агент, що сліпо застосує пораду, зробить
`npm install`. У нашому проєкті нові залежності — лише після окремого рішення людини, ці правила не
застосовуємо.

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen Agent Trust Hub | PASS, risk level SAFE (єдина позначка — `INDIRECT_PROMPT_INJECTION` як загальна поверхня: скіл обробляє чужий код; зловмисного не знайдено) | 14.09.2026 22:49 |
| Socket | PASS (malicious behavior, security concerns, obfuscation, suspicious patterns — чисто) | 14.09.2026 22:49 |
| Snyk | PASS, risk level LOW, «No issues detected» | 14.09.2026 22:48 |

- Де взяли: skills.sh, сторінки `…/vercel-react-best-practices/security/{agent-trust-hub,socket,snyk}` (27.09.2026). Встановлень — 747,5 тис., first seen 19.01.2026.
- Чому CLI не показав блок: `--list` і встановлення запускались із `DISABLE_TELEMETRY=1`, а з цією
  змінною CLI аудити не завантажує. Крім того, встановлення запускав агент (Claude Code) від імені
  автора роботи, тож CLI сам увімкнув `--yes` і підтвердження не питав. Саме тому аудити прочитано на
  skills.sh **до** запуску встановлення, а рішення «ставимо» прийнято тут, до коміту встановлення.
- До чого прив'язаний аудит: **не** до нашого тега. Сторінка skills.sh — «репозиторій + назва скіла»;
  Socket вказує `pkg:socket/skills-sh/vercel-labs/agent-skills/vercel-react-best-practices@ca7b0c0c…` —
  хеш вмісту, а не git-тег. Перевірили, чи аудит міг стосуватися іншого вмісту: хеш дерева
  `skills/react-best-practices` на нашому тезі (`git rev-parse HEAD:skills/react-best-practices` =
  `343db72180d0…`) **збігається** з деревом на `main` (GitHub API `contents/skills`), а останній
  коміт, що змінював скіл, — `dc8367e` від 14.04.2026. Тобто аудит 14.09.2026 бачив той самий вміст,
  що й наш тег. Після оновлення тега цю перевірку треба повторити.

## 4. Ліцензія й походження

- Ліцензія: MIT — заявлена у frontmatter `SKILL.md` (`license: MIT`) і в розділі «License» кореневого
  `README.md`. Окремого файлу `LICENSE` у репозиторії **немає**, і GitHub ліцензію не визначає
  (`license: null` в API). Для комерційного клієнтського проєкту MIT підходить; зауваження — текст
  ліцензії з копірайтом формально відсутній, для суворої перевірки ліцензійної чистоти варто мати
  підтвердження від Vercel або посилання на цей розділ README в нашому реєстрі залежностей.
- Видавець і активність: організація `vercel-labs` (Vercel), репозиторій створено 08.12.2025,
  31,6 тис. зірок, останній push 28.08.2026 (= наш тег). Скіл підтримується активно (зміни березень–квітень 2026).

## 5. Чи правдивий зміст для нашого стеку

Звіряли з локальною документацією Next.js 16.3.5 (`node_modules/next/dist/docs/`).

| Порада скіла (id) | Що каже скіл | Що каже документація нашої версії | Висновок |
|---|---|---|---|
| `async-parallel` | Незалежні `await` — через `Promise.all()` | `01-getting-started/06-fetching-data.md` → «Parallel data fetching»: layouts і pages рендеряться паралельно, але всередині компонента послідовні `await` блокують один одного; приклад із `Promise.all` | Діє без застережень. Застосовуємо на `/dashboard` |
| `server-cache-react` | `React.cache()` для дедуплікації в межах запиту | `06-fetching-data.md` → «Reusing data with React.cache»: для ORM/БД без `fetch` — `cache()`; кеш лише на один запит | Діє. Важливо: layout і page рендеряться паралельно й обидва кличуть `getCurrentUser` — саме тут дедуплікація й потрібна. Варіант з `'use cache: private'` — лише з Cache Components, які в проєкті не ввімкнено |
| `server-serialization` | У Client Component передавати лише потрібні поля | `02-guides/data-security.md`: «Return safe, minimal DTOs», дані перед передачею в Client Component треба санітизувати | Діє й посилюється вимогою безпеки. Застосовуємо до `LeadsTable` |
| `bundle-barrel-imports` | Радить `experimental.optimizePackageImports: ['lucide-react', '@mui/material']` | `05-config/01-next-config-js/optimizePackageImports.md`: опція досі `experimental`; `lucide-react`, `@mui/material`, `recharts` **уже оптимізуються за замовчуванням** | Для наших `recharts` порада нічого не дає — не застосовуємо. `lodash` (не `lodash-es`) у списку немає, але імпорт один (`debounce`) |
| `async-dependencies`, `server-cache-lru` | Додати `better-all` / `lru-cache` | Документація Next 16 для кешу між запитами пропонує `'use cache'` (Cache Components), а не сторонній LRU | Не застосовуємо: нові залежності без рішення людини, а для 16 є вбудований механізм |

## 6. Закріплення версії й коміт

- Команда встановлення:
  ```bash
  DISABLE_TELEMETRY=1 npx skills@1.7.0 add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 \
    --skill vercel-react-best-practices -a claude-code --copy
  ```
  Scope — Project. CLI закріплено на `skills@1.7.0`.
- Де лягли файли: `.claude/skills/vercel-react-best-practices/` — справжні файли (`--copy`), не symlink;
  `.agents/` не створюється (`-a claude-code` без `cursor`).
- Що потрапило в git: тека скіла (75 файлів) і `skills-lock.json` (джерело, тег, хеш).
- Як оновлювати: та сама команда з новим тегом → `git diff .claude/skills/vercel-react-best-practices skills-lock.json`
  → рев'ю змін за цим чеклістом (скрипти, `allowed-tools`, хуки, посилання, нові залежності, аудит
  саме нового вмісту) → окремий коміт.

## Вердикт

**Встановити з умовами.** Ризик низький: скіл — лише markdown без скриптів, хуків, MCP і
`allowed-tools`, прихованих інструкцій немає, три аудити PASS на тому самому вмісті, видавець —
Vercel, MIT. Умови: версія закріплена тегом і перевіряється через `skills-lock.json`; кожну пораду
перед застосуванням звіряємо з `node_modules/next/dist/docs/`; поради, що вимагають нових залежностей
(`better-all`, `lru-cache`) чи `experimental`-опцій, без окремого рішення не застосовуємо.
