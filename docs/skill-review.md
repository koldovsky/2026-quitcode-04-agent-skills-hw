# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення. Файли скіла читались як дані з неглибокого клону поза
> репозиторієм (`../review-agent-skills`); нічого з них не виконувалось, тека не відкривалась як
> проєкт в агенті.

**Дата, інструмент, ОС:** 27.09.2026 · Claude Code (розширення VS Code) · Windows 11 + Git Bash

## Що рев'юємо

| | |
|---|---|
| Репозиторій | https://github.com/vercel-labs/agent-skills |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` |
| Версія | тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` = коміт `063bee94c3f4df8453406c830b0a7df0f2860278` (merge PR #328, 2026-08-28) |
| Навіщо нам | клієнт скаржиться на дашборд > 2 с і «задумливу» форму; експерта з продуктивності React у команді немає — скіл дає агенту правила для рев'ю й виправлень |

## 1. Подивитись, не встановлюючи

- Як дивились: `git clone --depth 1 --branch agent-skills-063bee9… https://github.com/vercel-labs/agent-skills.git ../review-agent-skills`;
  `git rev-parse HEAD` → `063bee94c3f4df8453406c830b0a7df0f2860278`, `git describe --tags` → той самий тег.
  CLI на тезі показав `Found 9 skills` у репозиторії; нам потрібен лише `vercel-react-best-practices`.
- Склад скіла (76 файлів у клоні; CLI копіює 75 — без `metadata.json`):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7,4 КБ | frontmatter + індекс 70 правил за 8 категоріями (префікси `async-`, `bundle-`, `server-`, `client-`, `rerender-`, `rendering-`, `js-`, `advanced-`) |
  | `AGENTS.md` | 112 КБ | усі правила, зібрані в один документ |
  | `README.md` | 3,5 КБ | опис скіла для людей |
  | `metadata.json` | 0,9 КБ | версія 1.0.0, організація, анотація, список посилань (CLI не копіює) |
  | `rules/*.md` | 72 файли, ~290 КБ | по файлу на правило + `_sections.md`, `_template.md` |

- Frontmatter `SKILL.md` (поля): `name`, `description`, `license: MIT`, `metadata` (`author: vercel`,
  `version: "1.0.0"`). Немає `allowed-tools`, `hooks`, `context`, `model`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли (`.sh`, `.mjs`, `.py`…) | немає; єдиний не-markdown файл — `metadata.json` (дані) | `find "$S" -type f ! -name "*.md"` |
| `allowed-tools` | немає | `awk '/^---$/{n++; next} n==1' "$S/SKILL.md"` |
| Команди під час рендеру `` !`cmd` `` | немає (0 збігів) | `grep -rn '!\`' "$S"` |
| Хуки, MCP-сервери, `plugin.json`, вимога API-ключів | немає (0 файлів, у тексті вимог ключів немає) | `find "$S" -name "*hooks*.json" -o -name "*mcp*.json" -o -name "plugin.json" -o -name "settings*.json"` |
| Інструкції агенту щось завантажити чи виконати | 2 збіги: `npx svgo --precision=1 --multipass icon.svg` у `rules/rendering-svg-precision.md:27` і в `AGENTS.md:2477` — приклад оптимізації SVG для розробника, не інструкція завантажити правила; у нашому проєкті не застосовуємо | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch" "$S"` |
| Посилання: куди ведуть | 36 унікальних URL: документація `react.dev`, `nextjs.org`, `vercel.com` (блог, docs), `swr.vercel.app`, GitHub (`isaacs/node-lru-cache`, `shuding/better-all`, gist), MDN, esbuild, vite, webpack, npm, csstriggers, jsfiddle, `x.com/shuding`; `*.example.com` — у прикладах коду. Жодного «прочитай інструкції звідси» | `grep -rhoE "https?://…" "$S" \| sort -u` |
| Приховані інструкції: HTML-коментарі, «ignore previous…», невидимі символи, base64 | немає: 0 збігів на `ignore previous / system prompt / <!--`; `0 file(s) with zero-width characters`; довгих base64-рядків (≥ 80 символів) немає | `grep -rniE …`, однорядник `node -e …` з шаблону, `grep -rlE "[A-Za-z0-9+/]{80,}"` |

Поза текою скіла в репозиторії є `scripts/`, `packages/`, `package.json` і `*.zip` — CLI з
`--skill vercel-react-best-practices` їх не встановлює, у проєкт потрапляє лише тека скіла.

## 3. Аудити

<!-- TODO(людина): заповніть з https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices
     або з блоку «Security Risk Assessments» CLI (запуск БЕЗ DISABLE_TELEMETRY у звичайному терміналі). -->

| Аудит | skills.sh | CLI («Security Risk Assessments») | Дата аналізу |
|---|---|---|---|
| Gen (Agent Trust Hub) | Pass | Safe | Sep 14, 2026, 10:49 PM |
| Socket | Pass | 0 alerts | Sep 14, 2026, 10:49 PM |
| Snyk | Pass | Low Risk | Sep 14, 2026, 10:48 PM |

- Де взяли: сторінка https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices і
  блок «Security Risk Assessments» у CLI (`npx skills@1.7.0 add …` без `DISABLE_TELEMETRY`, у
  звичайному терміналі, перед «Proceed with installation?»).
- Чому CLI показав блок: запуск без `DISABLE_TELEMETRY`/`DO_NOT_TRACK` і не з агентської сесії
  (там CLI сам вмикає `--yes` і не чекає підтвердження). З `DISABLE_TELEMETRY=1` блоку немає.
- Розбіжність: Snyk у CLI — «Low Risk», на skills.sh — «Pass»; конкретних знахідок ні CLI, ні
  сторінка не розкривають.
- До чого прив'язаний аудит: **не до нашого тега.** Дата аналізу (14.09.2026) пізніша за наш коміт
  (28.08.2026); CLI посилається на `skills.sh/vercel-labs/agent-skills` (весь репозиторій), а
  skills.sh показує команду без тега (`npx skills add https://github.com/vercel-labs/agent-skills
  --skill …`). Тобто аудит — для «репозиторій + назва скіла» на момент аналізу, а не для
  `agent-skills-063bee9…`. Тому він лише додатковий сигнал; основа рішення — власна перевірка
  файлів тега (розділ 2).

## 4. Ліцензія й походження

- Ліцензія: MIT — заявлена у frontmatter `SKILL.md` (`license: MIT`) і в `README.md` репозиторію
  (розділ «License»). Окремого файлу `LICENSE` у корені тега немає.
- Видавець і активність: організація `vercel-labs` (Vercel Engineering, `metadata.author: vercel`);
  закріплений коміт від 28.08.2026 (merge PR #328), репозиторій активно оновлюється.
  За skills.sh: 746,9 тис. встановлень, 31,6 тис. зірок на GitHub, репозиторій верифікований,
  уперше з'явився 19.01.2026.

## 5. Чи правдивий зміст для нашого стеку

Звірено з `node_modules/next/dist/docs/` (Next.js 16.3.5):

| Порада скіла (id) | Що каже скіл | Що каже документація нашої версії | Висновок |
|---|---|---|---|
| `async-parallel` | незалежні запити — через `Promise.all()` | `01-app/01-getting-started/06-fetching-data.md`, «Parallel data fetching»: layout і page рендеряться паралельно, але всередині компонента `await` один за одним — послідовні; рекомендовано `Promise.all` | діє → застосовуємо в `app/dashboard/page.tsx` |
| `server-serialization` | передавати в Client Component лише поля, які він використовує | `05-server-and-client-components.md`: props клієнтських компонентів серіалізуються в RSC Payload; `02-guides/data-security.md`: повертати «safe, minimal DTO» | діє → застосовуємо до `LeadsTable` (зараз отримує весь `Lead` з `rawPayload`, `ipAddress`, `internalNotes`) |
| `bundle-barrel-imports` | імпортувати напряму, не з barrel-файлів (у списку — `lodash`, `recharts`-подібні) | `03-api-reference/05-config/01-next-config-js/optimizePackageImports.md`: `recharts` і `lodash-es` Next.js 16 оптимізує **автоматично**; CJS-пакета `lodash` у списку немає | для `recharts` порада в 16.3.5 зайва — не застосовуємо; для `lodash` актуальна (`lodash/debounce`) |

<!-- TODO: допишіть сюди поради, які агент запропонує на кроці 5 і які ви відкинете після звірки. -->

## 6. Закріплення версії й коміт

- Команда встановлення (у звичайному терміналі Git Bash, не з агента):
  `npx skills@1.7.0 add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 --skill vercel-react-best-practices -a claude-code --copy`;
  Installation scope → **Project**; «Installation Summary»: `copy → Claude Code`.
- Де лягли файли; справжні файли чи посилання: `.claude/skills/vercel-react-best-practices/`,
  75 файлів (`find … -type f | wc -l`; у клоні тега 76 — CLI не копіює `metadata.json`),
  справжні файли завдяки `--copy`; `ls .agents` → теки немає, другої копії немає.
- Що потрапило в git: тека скіла (75 файлів) і `skills-lock.json` — коміт `8bc9f78`. У lock-файлі:
  `source: vercel-labs/agent-skills`, `ref: agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278`,
  `computedHash: 6b526d01…60ca6b`.
- Скіл видно: `/skills` у новій сесії Claude Code → `/vercel-react-best-practices` · project.
- Як оновлювати: та сама команда з новим тегом → `git diff` → рев'ю змін за цим чеклістом → коміт

## Вердикт

**Встановити з умовами.** Скіл — лише markdown-довідка: без скриптів, хуків, MCP, `allowed-tools`
і прихованих інструкцій; єдина команда (`npx svgo`) — приклад для розробника, не інструкція агенту.
Умови: версія закріплена тегом `agent-skills-063bee9…` і вендорена в git справжніми файлами;
кожну пораду перед застосуванням звіряємо з документацією Next.js 16 (частина вже не потрібна,
напр. barrel-імпорти `recharts`); оновлення — лише через повторне рев'ю діфу.
