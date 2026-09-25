# Рев'ю стороннього скіла: `czlonkowski/n8n-skills` (Task E1)

> Рев'ю **без встановлення**. Файли пакета читали як дані — з неглибокого клону поза репозиторієм
> (`../review-n8n-skills`); клон не відкривали як проєкт в агенті, нічого з нього не запускали й не встановлювали,
> жодного файлу в репозиторій не копіювали.

**Дата, інструмент, ОС:** 25.09.2026 · Claude Code 2.1.252 (Opus 5.5) · macOS 15 (Darwin 24.6) + zsh · Node 24.21

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/czlonkowski/n8n-skills> (альтернативу `n8n-io/skills` не рев'ювали) |
| Тека в репозиторії → `name` | 15 скілів у `skills/*/SKILL.md` (`n8n-workflow-patterns`, `n8n-mcp-tools-expert`, `n8n-node-configuration`, `n8n-code-javascript`, `n8n-code-python`, `n8n-code-tool`, `n8n-validation-expert`, `n8n-expression-syntax`, `n8n-error-handling`, `n8n-binary-and-data`, `n8n-subworkflows`, `n8n-agents`, `n8n-multi-instance`, `n8n-self-hosting`, `using-n8n-mcp-skills`) + плагін `n8n-mcp-skills` v1.35.0 (хуки, MCP) |
| Версія | коміт `19cd793f4789e3ef9c657ccf26e097f641a77df0` (16.09.2026, Romuald Członkowski) = тег **`v1.35.0`** (`gh api …/git/ref/tags/v1.35.0` → той самий SHA) |
| Навіщо нам | потенційно — підказки агенту, коли інтеграція з n8n зачіпає й бік воркфлоу (налаштування вузлів, вирази, обробка помилок). Наш скіл `integrating-n8n-webhooks` воркфлоу свідомо не будує |

## 1. Подивитись, не встановлюючи

- Як дивились: `git clone --depth 1 https://github.com/czlonkowski/n8n-skills.git ../review-n8n-skills`,
  `git -C ../review-n8n-skills log -1 --format='%H %ci %an'` → `19cd793f… 2026-09-16 12:56:33 +0200`;
  176 файлів (без `.git`), 6,8 МБ разом із `.git` (3,6 МБ без нього); сторінки на GitHub і skills.sh — у вбудованому браузері.
- Склад пакета:

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `skills/*/SKILL.md` + довідки | 15 скілів, 188–659 рядків у `SKILL.md` (у 6 — понад 400) | markdown-інструкції; `n8n-expression-syntax` — 659 рядків |
  | `skills/n8n-self-hosting/assets/` | 6 файлів | `docker-compose.*.yml`, `Caddyfile`, `.env.*.example` (плейсхолдери `REPLACE_WITH_openssl_rand_…`), `init-data.sh` |
  | `hooks/hooks.json` + 10 `*.sh` | ~465 рядків bash | хуки плагіна Claude Code: `SessionStart`, 7 × `PreToolUse`, 1 × `PostToolUse` |
  | `mcp.json` | 9 рядків | віддалений MCP-сервер `n8n-mcp`: `streamable-http`, `https://api.n8n-mcp.com/mcp` |
  | `.mcp.json.example` | 15 рядків | локальний варіант: `npx n8n-mcp` з `N8N_API_URL` і **`N8N_API_KEY`** |
  | `plugin.json`, `.claude-plugin/{plugin,marketplace}.json` | — | маніфести плагіна / маркетплейсу |
  | `build.sh` | 92 рядки | збирання zip-архівів для публікації (для користувача не потрібен) |
  | `evaluations/**/*.json` (62), `docs/*.md` (5), `CLAUDE.md`, `README.md` | — | тести спрацювання, документація розробника |
  | `LICENSE`, `NOTICES`, `NOTICES-APACHE-2.0.txt` | — | MIT + частина коду з `n8n-io/skills` (Apache-2.0) |

- Frontmatter кожного `SKILL.md`: лише `name` і `description` (`name` = назва теки в усіх 15). **Немає**
  `allowed-tools`, `hooks`, `context`.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли | Скіли — без скриптів (крім `assets/init-data.sh` — SQL-ініціалізація Postgres для docker-compose, запускається лише якщо людина розгорне compose). Виконуване — **хуки плагіна** (10 bash-скриптів) і `build.sh` (лише для автора: zip-архіви в `dist/`) | `find "$S" -type f ! -name "*.md"`; `cat build.sh` |
| `allowed-tools` | Немає в жодному з 15 `SKILL.md` | `awk` по frontmatter; `grep -ln "^allowed-tools:"` |
| Команди під час рендеру `` !`cmd` `` | Немає. 4 збіги — це markdown на кшталт `` `!` `==` `` (оператор), а не команди | `grep -rn '!`' skills` |
| **Хуки** | Встановлення **як плагіна** (`/plugin install czlonkowski/n8n-skills`, так радить README) вмикає: `SessionStart` (на `startup/resume/clear/compact`) — **вставляє весь `using-n8n-mcp-skills/SKILL.md` (188 рядків) у контекст кожної сесії**, створює `~/.cache/n8n-mcp-skills`, на clear/compact видаляє свої маркери в `$TMPDIR/n8n-mcp-skills-state`; 7 × `PreToolUse` на інструменти `mcp__*__get_node / n8n_create_workflow / n8n_update_* / validate_workflow / n8n_test_workflow / n8n_instances / n8n_manage_credentials` — одноразові нагадування «виклич скіл X» (маркер-файли в `$TMPDIR`); `PostToolUse` на `validate_workflow` — розбирає JSON воркфлоу через `jq` і радить скіли. Мережі, `eval`, `curl`, запису поза `~/.cache` і `$TMPDIR` у хуках немає; усі «fail open» | `cat hooks/hooks.json`; прочитано `session-start.sh`, `_emit.sh`, `create-workflow.sh`, `post-tool-use/validate-workflow.sh`; `grep -nE "curl\|wget\|npx\|eval\|base64\|rm \|http" hooks/**/*.sh` |
| **MCP-сервери, API-ключі** | `mcp.json` підключає **віддалений сторонній** сервер `https://api.n8n-mcp.com/mcp` — інструменти з даними воркфлоу йдуть на чужий хост. Альтернатива `.mcp.json.example` — `npx n8n-mcp` (npm-пакет, що виконується локально) з **`N8N_API_KEY`** інстанса n8n: через MCP агент може створювати й змінювати воркфлоу, запускати їх (`n8n_test_workflow` — «executes real nodes») і керувати credentials (`n8n_manage_credentials`). Самі скіли без MCP лишаються документацією | `cat mcp.json .mcp.json.example`; `grep -n "N8N_API" skills/using-n8n-mcp-skills/SKILL.md` |
| Інструкції агенту щось завантажити чи виконати | `npx n8n-mcp` (лише як спосіб підключити MCP), `curl` у `n8n-self-hosting` (перевірка DNS і healthz при розгортанні) і приклад `curl -X POST …/webhook/form-submit` — команди для людини в контексті, не «завантаж і виконай». Прихованих завантажень правил з URL немає | `grep -rnE "npx \|curl \|wget " skills` |
| Посилання | Увесь репозиторій без `.git`: заглушки `api.example.com` (60), `github.com` (54), `docs.n8n.io` (42), сайт автора `aiadvisors.pl` (19); лише в `skills/`: `api.example.com` (59), `docs.n8n.io` (38), `github.com` (15), `aiadvisors.pl` (7). `webhook.site` рекомендовано для тестів текстом, без посилання (сторонній сервіс — наші дані туди не шлемо). «Прочитай інструкції звідси» — немає | `grep -rhoE --exclude-dir=.git "https?://…" \| sed … \| sort \| uniq -c` (увесь репо і окремо `skills/`) |
| Приховані інструкції | HTML-коментарів і «ignore previous» — немає; 0 файлів із символами нульової ширини; довгих base64 — немає. Збіги «system prompt» — це зміст про AI-агентів у n8n | `grep -rniE "ignore … previous\|system prompt\|<!--"`; node-скрипт із шаблону; `grep -rnoE "[A-Za-z0-9+/]{120,}"` |

Висновок розділу: скіли як такі — markdown без виконуваних частин; ризики — у **плагінній** обгортці: постійний
`SessionStart`-контекст у кожній сесії (зокрема в наших, не про n8n), хуки на інструменти й особливо MCP-сервер —
віддалений сторонній хост або `npx`-пакет з API-ключем, що дає агенту повний доступ до інстанса n8n клієнта.

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen Agent Trust Hub | Pass · SAFE для `n8n-workflow-patterns`, `using-n8n-mcp-skills` (зауваження INDIRECT_PROMPT_INJECTION — робота з зовнішніми даними воркфлоу), `n8n-mcp-tools-expert` | 16.09.2026 (перші два), 14.09.2026 |
| Socket | Pass — ті самі три скіли | 16.09.2026, 14.09.2026 |
| Snyk | **Warn · MEDIUM** для `n8n-workflow-patterns` (W011: third-party content exposure — вебхук-пейлоади й відповіді API в контексті агента, ризик 0,30); Pass · LOW для двох інших | 16.09.2026, 14.09.2026 |

- Де взяли: <https://skills.sh/czlonkowski/n8n-skills> (15 скілів, 60,5K встановлень) → сторінки
  `…/<skill>/security/{agent-trust-hub,socket,snyk}` для трьох найважливіших скілів.
- Чому не з CLI: пакет не встановлювали; до того ж з `DISABLE_TELEMETRY=1` CLI аудитів не показує, а в агентській
  сесії сам вмикає `--yes`.
- До чого прив'язаний аудит: до «репозиторій + назва скіла» на дату аналізу (14–16.09), а **не** до тега; і лише до
  вмісту скіла — **хуки й MCP-сервер плагіна ці аудити не оцінюють**.

## 4. Ліцензія й походження

- Ліцензія: **MIT** (`LICENSE`, © 2025 Romuald Członkowski; GitHub розпізнає як MIT). `NOTICES` чесно вказує, що хуки
  (`hooks/hooks.json`, `session-start.sh`, …) адаптовано з **`n8n-io/skills`** (© n8n GmbH, Apache-2.0), копія
  ліцензії — `NOTICES-APACHE-2.0.txt`. При копіюванні таких файлів треба зберігати ці повідомлення.
- Видавець і активність: особистий акаунт (не організація n8n), автор — AiAdvisors (`aiadvisors.pl`), він же автор
  MCP-сервера `n8n-mcp`. Репозиторій з 20.10.2025, останній push і реліз `v1.35.0` — 16.09.2026; 6,3K зірок,
  1K форків, 15 відкритих issue; теги-релізи регулярні (`v1.31.0` → `v1.35.0`).

## 5. Чи правдивий зміст для нашого стеку

Звіряли твердження пакета із запискою команди `materials/n8n-webhooks-brief.md` (розділ 11 «Відомі пастки», розділи
3–5, 8) і фактами n8n звідти.

| Порада скіла (де) | Що каже скіл | Що кажуть записка / n8n | Висновок |
|---|---|---|---|
| Код відмови Header Auth (усі скіли) | Про 401 для Header Auth **нічого не каже**; `n8n-node-configuration` лише показує `authentication: "headerAuth"` / `httpHeaderAuth` | Записка: Header Auth → **403** «Authorization data is wrong!», 401 — Basic/JWT; помилку «401» записка приписує «офіційному пакету» (`n8n-io/skills`) | Прямого твердження «Header Auth → 401» немає, **але** власний рецепт автентифікації в `n8n-error-handling` (`SKILL.md:150`, `API_WORKFLOWS.md:88`) — перевірка в IF-вузлі з відповіддю **401 `unauthorized`**. Хто пише клієнт за цим рецептом, чекатиме 401, а вбудований Header Auth через credential відповідає **403** — плутанина та сама, що в записці. Для нас — лише наш скіл |
| Секрет вузла Crypto (`n8n-code-python`, `REVIEW_CHECKLIST.md`) | «Use the native Crypto node for hashing»; про джерело секрету (credential) не пише | Записка: Crypto **v2** бере Hmac Secret із **Crypto credential** | Не суперечить; неповно |
| Відповідь режиму Immediately | Про текст «Workflow got/was started» — нічого; `responseMode` за замовчуванням `onReceived` (підтвердити одразу) — описано правильно | Записка: текст не парсимо, дивимось на код статусу | Правдиво (у межах сказаного) |
| Таймаут вебхука (`webhook_processing.md:421`) | «**Webhook timeout: 120 seconds (default)**» | Записка: **120 с — це вікно тестового URL** після «Listen for test event»; ліміт відповіді на **n8n Cloud — 100 с, далі 524**; синхронно чекати довгий воркфлоу не можна | **Хибно / плутає два ліміти** — агент міг би вважати, що 90-секундний воркфлоу вкладеться в синхронну відповідь |
| Тестовий vs production URL | Окремо не пояснює; приклад `curl -X POST https://n8n.example.com/webhook/form-submit` — production-шлях | Записка: у коді й `.env.example` — лише `/webhook/`, тестовий — 120 с | Не суперечить, але пастки не попереджає |
| Перевірка підпису вебхука (`webhook_processing.md:122–140, 258–276`) | Code node: `crypto.createHmac('sha256', secret).update(JSON.stringify($input.item.body))` (в іншому прикладі — `.update($input.item.body)`, тобто об'єкт), порівняння **`signature !== expectedSig`**, без вікна часу | Записка: HMAC від **сирого** тіла `${timestamp}.${raw}`, спершу довжина, потім `timingSafeEqual`, вікно 300 с; повторна серіалізація змінює байти | **Хибно для нашого контракту** (і небезпечно: timing-атака, підпис не зійдеться на реальному тілі, replay). До того ж суперечить власному `REVIEW_CHECKLIST.md` («не `crypto.createHmac` у Code node — бери вузол Crypto») |
| Автентифікація вебхука (`webhook_processing.md:244–256`) | «Query Parameter Token»: IF-вузол `{{$json.query.token}} equals "your-secret-token"`; «Header-Based Auth — **Better security**»: IF `{{$json.headers['x-api-key']}} equals "your-api-key"` | Записка: Header Auth через **credential** вузла Webhook (n8n відхиляє сам, 403); токен ніколи в query string; секрет не в текстових полях | **Застаріло / небезпечно**: секрет прямо у виразі, порівняння не constant-time, токен у URL; суперечить власному «Secrets never go in text fields» з `using-n8n-mcp-skills`. Це та сама пастка, що записка (розділ 11) відзначає в прикладі документації Next.js — токен у `?token=` і порівняння через `!==` (GET кешується й осідає в журналах) |
| Асинхронний патерн (`n8n-error-handling/API_WORKFLOWS.md:234–239`) | «respond 202 immediately and continue async: Webhook → validate → Respond (202, {job_id}) → … → callback» | Записка: стандарт для довгих задач — Respond to Webhook **202 `{job_id}`** + колбек | **Правдиво**, збігається з контрактом |
| Ідемпотентність | Лише загально («make the workflow idempotent» для розкладу, dedup у sub-workflows); Remove Duplicates за `idempotency-key` — нічого | Записка: Remove Duplicates одразу після Webhook за `idempotency-key`; колбек — дедуп за ключем | Неповно |
| Тестування (`webhook_processing.md`) | «Use webhook.site for testing» | Записка: локальний офлайн-мок; дані клієнтів на сторонні сервіси не шлемо | Для нас — ні (приватність) |

## 6. Закріплення версії й коміт

- **Не встановлювали.** Якби колись ставили — лише окремий скіл, без плагіна:
  `npx skills@1.7.0 add "czlonkowski/n8n-skills#v1.35.0" --skill n8n-node-configuration -a claude-code --copy`
  (тег `v1.35.0` = `19cd793`; `--copy` — справжні файли в `.claude/skills/`, `skills-lock.json` у git).
- **Ніколи** — `/plugin install czlonkowski/n8n-skills` чи маркетплейс: це вмикає `SessionStart`-контекст у кожній
  сесії, хуки й MCP-сервер без окремого рев'ю; MCP з `N8N_API_KEY` клієнта — лише після окремого рішення людини.
- Що потрапило б у git: тека обраного скіла + `skills-lock.json`; `NOTICES` — якщо копіюємо адаптовані файли.
- Як оновлювати: та сама команда з новим тегом → `git diff` → рев'ю змін за цим чеклістом → коміт.

## Вердикт

**Не встановлювати як плагін; окремі скіли — лише з умовами, і в цьому проєкті — не потрібні.** Скіли — чистий
markdown без прихованих інструкцій, аудити Gen/Socket — Pass (Snyk — MEDIUM для `n8n-workflow-patterns`), ліцензія
в порядку. Але рекомендований спосіб встановлення — плагін, який додає постійний контекст у кожну сесію, хуки на
інструменти й MCP-сервер (сторонній віддалений хост або `npx`-пакет з API-ключем, що дає агенту повний доступ до
n8n клієнта) — аудити цього не покривають. І головне для нас: приклади безпеки вебхуків (`!==` на підписі, HMAC від
`JSON.stringify(body)`, секрет у IF-виразі, токен у query string) і «таймаут 120 с» суперечать запису команди й
нашому скілу `integrating-n8n-webhooks`. Якщо колись знадобиться допомога з боку воркфлоу — ставимо лише окремий
скіл (напр. `n8n-node-configuration`) з тегом `v1.35.0` і `--copy`, без плагіна, хуків і MCP, а все про вебхуки й
колбеки беремо з нашого скіла.
