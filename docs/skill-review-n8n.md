# Рев'ю стороннього скіла: пакет `czlonkowski/n8n-skills` (Task E1)

> Рев'ю **без встановлення**. Пакет читався як дані з неглибокого клону поза репозиторієм
> (`../ws04-work/review-n8n-skills`); клон не відкривали як проєкт в агенті, жодного скрипта чи хука не
> запускали, нічого не встановлювали.

**Дата, інструмент, ОС:** 25.09.2026 · Claude Code 2.1.280 (Opus 5.5) · Windows 10 Pro 19045 + Git Bash

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/czlonkowski/n8n-skills> |
| Тека в репозиторії → `name` | `skills/<15 тек>` → `name` = назва теки для кожного (`n8n-workflow-patterns`, `n8n-code-javascript`, `n8n-validation-expert`, `using-n8n-mcp-skills` …) |
| Версія | коміт `19cd793f4789e3ef9c657ccf26e097f641a77df0` (16.09.2026, `main`, «Merge pull request #53 …»); у маніфестах — `1.35.0`. Тегів, прив'язаних до рев'ю, не брали — закріплювали б за цим SHA |
| Навіщо нам | Перевірити, чи можна дати команді готові n8n-скіли замість / на додачу до власного `integrating-n8n-webhooks`: у клієнтських проєктах є люди, що налаштовують воркфлоу в n8n |

## 1. Подивитись, не встановлюючи

- Як дивились: `git clone --depth 1 https://github.com/czlonkowski/n8n-skills.git ../ws04-work/review-n8n-skills`,
  `git -C … rev-parse HEAD` → `19cd793…`; читання файлів командами нижче; сторінки skills.sh.
- Склад пакета (176 файлів без `.git`; у `skills/` — 85 файлів, 1,3 МБ):

  | Файл / тека | Що це |
  |---|---|
  | `skills/*/SKILL.md` (15) + довідкові `.md` | 14 тематичних скілів (вирази, Code-вузли JS/Python, валідація, конфігурація вузлів, error handling, sub-workflows, AI-агенти, self-hosting…) і «router»-скіл `using-n8n-mcp-skills` |
  | `plugin.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | маніфести **плагіна** Claude Code / marketplace (версія 1.35.0) |
  | `mcp.json` | **MCP-сервер** `n8n-mcp`: `streamable-http` на віддалений `https://api.n8n-mcp.com/mcp` |
  | `.mcp.json.example` | локальний варіант: `npx n8n-mcp` з `N8N_API_URL` і **`N8N_API_KEY`** |
  | `hooks/hooks.json` + 10 `.sh` | **хуки**: `SessionStart` і `PreToolUse`/`PostToolUse` на інструменти `mcp__*__…` |
  | `build.sh` | збирання zip-пакетів для розповсюдження |
  | `evaluations/**/*.json` (60) | тестові сценарії спрацювання скілів |
  | `skills/n8n-self-hosting/assets/` | `docker-compose.*.yml`, `Caddyfile`, `.env.*.example`, `init-data.sh` |
  | `LICENSE`, `NOTICES`, `NOTICES-APACHE-2.0.txt` | MIT; частина хуків і документації — адаптація `n8n-io/skills` (Apache-2.0) |

- Frontmatter усіх 15 `SKILL.md`: лише `name` і `description`. Немає `allowed-tools`, `hooks`, `context`, `model`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли | **Є**: 10 bash-хуків, `build.sh`, `skills/n8n-self-hosting/assets/init-data.sh`. Хуки лише читають JSON зі stdin (через `jq` або `python3`), пишуть маркери в `${TMPDIR}/n8n-mcp-skills-state/` і `~/.cache/n8n-mcp-skills/`, друкують `additionalContext`; мережі не викликають | `find . -type f ! -name "*.md"`; прочитано `hooks.json`, `session-start.sh`, `_emit.sh`, `get-node.sh`, `validate-workflow.sh`; `grep -nE "rm \|mkdir\|touch\|curl\|python3\|eval\|exec " hooks -r` |
| `allowed-tools` | Немає в жодному `SKILL.md` | frontmatter усіх 15 файлів |
| Команди під час рендеру `` !`cmd` `` | Немає (4 збіги — приклади `` `&&` `||` `` у таблицях і шаблонні рядки в `COMMON_MISTAKES.md`) | `grep -rn '!`' skills` |
| Хуки | **Є, і вони «завжди ввімкнені»**: `SessionStart` (startup/resume/clear/compact) вставляє весь `using-n8n-mcp-skills/SKILL.md` (188 рядків) у **кожну** сесію — навіть не про n8n; `PreToolUse` на `get_node`, `n8n_create_workflow`, `n8n_update_*`, `validate_workflow`, `n8n_test_workflow`, `n8n_instances`, `n8n_manage_credentials` дописують агенту «invoke the … skill via the Skill tool» | `hooks/hooks.json`, `hooks/session-start.sh` |
| MCP-сервери | **Є**: `mcp.json` підключає віддалений хостинговий сервер `https://api.n8n-mcp.com/mcp` (стороння служба, дані воркфлоу йдуть туди) | `cat mcp.json` |
| `plugin.json` / маніфест плагіна | **Є** — пакет задуманий як плагін (`/plugin install czlonkowski/n8n-skills` у README) | `plugin.json`, `.claude-plugin/*`, `README.md:232–248` |
| Вимога API-ключів чи секретів | **Є**: для роботи з інстансом n8n — `N8N_API_URL` + `N8N_API_KEY` (`.mcp.json.example`, `n8n-mcp-tools-expert/SKILL.md:362`, `using-n8n-mcp-skills/SKILL.md:122`) — ключ з правами на воркфлоу й credentials клієнта | `grep -rnE "N8N_API_KEY\|api[_-]?key"` |
| Інструкції агенту щось завантажити чи виконати | `npx n8n-mcp` (запуск стороннього npm-пакета), `curl`/`wget` у `n8n-self-hosting` (healthcheck, `CREDENTIAL_OVERWRITES.md:51` — POST з Bearer-токеном), `uv pip install pandas` у `TASK_RUNNERS.md`; README радить `/plugin install` | `grep -rnE "npx \|curl \|wget \|pip install\|npm install" skills` |
| Посилання | Переважно `docs.n8n.io` (38), `github.com` (25), `aiadvisors.pl` (7, сайт автора), плейсхолдери `*.example.com`. Інструкцій «прочитай правила звідси» не знайдено | `grep -rhoE "https?://…" skills hooks \| sort \| uniq -c` |
| Приховані інструкції | HTML-коментарів і «ignore previous» немає; збіги «system prompt» — тексти про системні промпти **AI-агентів у n8n**, не звернення до нас; zero-width символів — 0 файлів; base64 не знайдено | `grep -rniE "ignore … previous\|system prompt\|<!--"`, node-скрипт з шаблону |

**Висновок розділу:** на відміну від скіла Vercel (лише markdown), цей пакет приносить виконуваний код (хуки,
які Claude Code запускає сам), завжди-ввімкнений контекст у кожній сесії, віддалений MCP-сервер третьої
сторони і потребує API-ключа до n8n клієнта. Шкідливого коду не знайдено, але поверхня довіри значно більша.

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen (Agent Trust Hub) | Pass (для `n8n-workflow-patterns`) | не вказано |
| Socket | Pass (для `n8n-workflow-patterns`) | не вказано |
| Snyk | **Warn**, MEDIUM: «W011 — Third-party content exposure (indirect prompt injection risk)» — скіл обробляє вільний текст ззовні (тіла вебхуків, відповіді API) без захисту від prompt injection | 16.09.2026 |

- Де взяли: <https://skills.sh/czlonkowski/n8n-skills> (15 скілів, 60,5 тис. встановлень разом) і
  `…/n8n-workflow-patterns`, `…/n8n-workflow-patterns/security/snyk`. Сторінка репозиторію вердиктів не
  показує — лише сторінки окремих скілів; переглянуто найпопулярніший (11 тис. встановлень, «First seen»
  20.01.2026).
- Чому не з CLI: нічого не встановлювали, `npx skills add … --list` не запускали — для рев'ю досить клону.
- До чого прив'язаний аудит: до «репозиторій + назва скіла», не до нашого SHA; **хуки, `mcp.json` і
  маніфести плагіна аудити skills.sh не охоплюють** — вони оцінюють `SKILL.md`, а не плагін цілком.

## 4. Ліцензія й походження

- Ліцензія: MIT (`LICENSE`, © 2025 Romuald Członkowski; GitHub API: `license: MIT`); `NOTICES` — частина
  хуків і документації адаптована з `n8n-io/skills` (Apache-2.0, `NOTICES-APACHE-2.0.txt`).
- Видавець і активність: приватний автор (AiAdvisors), він же автор MCP-сервера `n8n-mcp`; репозиторій
  створено 20.10.2025, останній push 16.09.2026, 6,3 тис. зірок, активні PR. Це **не** офіційний пакет n8n.

## 5. Чи правдивий зміст для нашого стеку

Звірено з запискою команди (`materials/n8n-webhooks-brief.md`, розділ «Відомі пастки» і розділи 3–5) і
документацією n8n, на яку вона посилається.

| Порада пакета (файл) | Що каже пакет | Що кажуть записка / документація n8n | Висновок |
|---|---|---|---|
| Header Auth → 401 (пастка з записки про офіційний пакет) | У цьому пакеті твердження «Header Auth відхиляє з 401» **не знайдено**; 401/403 згадуються лише як коди, які ваш воркфлоу сам повертає через Respond to Webhook (`n8n-error-handling/SKILL.md:150–151`) | Код n8n відповідає на поганий Header Auth **403** «Authorization data is wrong!» | Пастки тут немає — цей пакет її не успадкував |
| Секрет вузла Crypto (пастка з записки) | Про прив'язку секрету до credential не сказано; `n8n-validation-expert/REVIEW_CHECKLIST.md:76` радить замість `crypto.createHmac` у Code-вузлі брати нативний вузол Crypto | Crypto v2 бере Hmac Secret із Crypto credential | Узгоджено з запискою. Але **той самий пакет** у `n8n-workflow-patterns/webhook_processing.md:122–137, 262–276` дає приклади саме Code-вузла з `crypto.createHmac` — внутрішня суперечність |
| Перевірка підпису вебхука (`webhook_processing.md:131–136`, `:267–274`) | `if (signature !== expectedSig)`; HMAC рахується від `JSON.stringify($input.item.body)` (у першому прикладі — від об'єкта `body`) | Порівнювати довжини й `timingSafeEqual`, ніколи `===`/`!==`; підписувати **сирі байти**, бо повторна серіалізація змінює тіло | **Суперечить контракту**: timing-атака і хибні 401 на переформатованому тілі. Той самий патерн у Next.js-роуті наш `check-contract` відхиляє (C4, C5) |
| Режими відповіді (`webhook_processing.md:304–320`, `:456–459`) | «Set `responseMode: "lastNode"` to use Webhook Response node» | Три різні режими: Immediately (`onReceived`), When Last Node Finishes (`lastNode`), **Using 'Respond to Webhook' Node** (`responseNode`) — для 202 + колбек потрібен саме останній | **Хибно** (і суперечить іншому скілу того ж пакета: `n8n-error-handling/API_WORKFLOWS.md:12–22` правильно пише `responseMode: "responseNode"`) |
| Таймаут вебхука (`webhook_processing.md:421`) | «Webhook timeout: 120 seconds (default)» | 120 с — вікно **тестового** URL після «Listen for test event»; на n8n Cloud синхронна відповідь обривається з **524 через 100 с** | Неточно: з такою порадою легко отримати 524 на довгому воркфлоу |
| «Workflow got started» / текст відповіді | Не згадано | Не парсити текст (документація й код різняться) | — |
| Тестовий vs production URL | Окремо не пояснено; є «Activate workflow» у чеклістах | Лише `/webhook/…` у коді й `.env.example`; n8n 2.x — Publish після змін | Прогалина — для нашої задачі це найчастіша помилка |

## 6. Закріплення версії й коміт

- Команда встановлення, якщо колись вирішимо ставити: **не** `/plugin install czlonkowski/n8n-skills` (без
  версії, з хуками й MCP), а лише окремі теки скілів з конкретного SHA, наприклад
  `npx skills@1.7.0 add "czlonkowski/n8n-skills#19cd793f4789e3ef9c657ccf26e097f641a77df0" --skill n8n-expression-syntax -a claude-code --copy`
  — після окремого рев'ю кожного скіла.
- Де лягли б файли: `.claude/skills/<name>/` справжніми файлами (`--copy`); хуки й `mcp.json` при такому
  встановленні не підключаються — їх не беремо.
- Що потрапило в git: нічого — рев'ю без встановлення.
- Як оновлювати: той самий шлях з новим SHA → `git diff` → рев'ю за цим чеклістом.

## Вердикт

**Не встановлювати в клієнтські проєкти LeadDesk-типу.** Пакет корисний людям, які будують воркфлоу в
редакторі n8n через `n8n-mcp`, але для нашої задачі (Next.js ↔ n8n за контрактом команди) він не про те й
приносить зайвий ризик: хуки, що виконуються самі й вставляють 188 рядків у кожну сесію, віддалений
MCP-сервер третьої сторони, вимогу `N8N_API_KEY` з доступом до воркфлоу й credentials клієнта, Snyk Warn
(prompt injection). До того ж його поради щодо вебхуків суперечать нашому контракту (`!==` для підпису,
HMAC від повторно серіалізованого тіла, `lastNode` замість `responseNode`, «120 с» замість 100 с / 524).
Якщо команді, що працює в редакторі n8n, знадобляться окремі скіли (наприклад `n8n-expression-syntax`):
лише як окремі теки з закріпленим SHA, без плагіна, хуків і MCP, з рев'ю кожного скіла й звіркою порад про
вебхуки з `integrating-n8n-webhooks`.
