# Рев'ю стороннього пакета скілів: `czlonkowski/n8n-skills` (Task E1, бонус)

> Пакет **не встановлювали**: ні `npx skills add`, ні `/plugin install`, ні копіювання в `.claude/`. Читали неглибокий
> клон **поза** репозиторієм (`../review-n8n-skills`), теку як проєкт в агенті не відкривали, жодного скрипта чи хука з
> неї не запускали. Перевірка: `ls .claude/skills` у проєкті — лише наші три скіли; `grep -rl n8n-mcp-skills ~/.claude/plugins` — нічого.

**Дата, інструмент, ОС:** 26.09.2026 · Claude Code 2.1.283 · macOS (Darwin 24.6) + zsh

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/czlonkowski/n8n-skills> |
| Тека в репозиторії → `name` | `skills/*` — 15 скілів (`using-n8n-mcp-skills`, `n8n-workflow-patterns`, `n8n-code-javascript`, `n8n-expression-syntax`, `n8n-self-hosting`, …) + плагін Claude Code `n8n-mcp-skills` |
| Версія | коміт `19cd793f4789e3ef9c657ccf26e097f641a77df0` (2026-09-16, merge PR #53), плагін `1.35.0` |
| Навіщо нам | Команда пише Next.js поверх n8n; питання — чи варто ставити цей пакет поряд із нашим `integrating-n8n-webhooks` |

## 1. Подивитись, не встановлюючи

- Як дивились: `git clone --depth 1 https://github.com/czlonkowski/n8n-skills.git ../review-n8n-skills`,
  `git -C ../review-n8n-skills rev-parse HEAD` → `19cd793f4789…`. Метадані — `gh api repos/czlonkowski/n8n-skills`.
- Склад (176 файлів у репозиторії):

  | Файл / тека | Що це |
  |---|---|
  | `skills/` (15 скілів, 85 файлів, 1,2 МБ) | `SKILL.md` + довідкові `.md` на скіл; у `n8n-self-hosting/assets/` — `docker-compose.*.yml`, `Caddyfile`, `.env.*.example`, `init-data.sh` |
  | `hooks/` (11 файлів) | `hooks.json` + 10 bash-скриптів: `SessionStart`, 7 `PreToolUse`, 1 `PostToolUse` і спільний `_emit.sh` |
  | `plugin.json`, `.claude-plugin/{plugin,marketplace}.json` | маніфести плагіна `n8n-mcp-skills` 1.35.0 |
  | `mcp.json` | MCP-сервер `n8n-mcp`: `streamable-http`, `https://api.n8n-mcp.com/mcp` |
  | `.mcp.json.example` | локальний варіант: `npx n8n-mcp` з `N8N_API_URL` і `N8N_API_KEY` |
  | `evaluations/`, `build.sh`, `CLAUDE.md`, `docs/`, `skills.png` | тести скілів, збирання zip-пакетів, інструкції для розробників пакета |

- Frontmatter `SKILL.md`: лише `name` і `description`; `allowed-tools`, `hooks`, `context` у скілах немає
  (`grep -rn "^allowed-tools\|^hooks:\|^context:" skills` — 0).

## 2. Що пакет може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| Виконувані файли | **Так:** 10 bash-скриптів хуків і `build.sh`; у скілі `n8n-self-hosting` — `init-data.sh` (створює користувача Postgres у контейнері) | `find . -type f ! -name "*.md"`, читання кожного скрипта |
| Хуки | **Так, при встановленні як плагіна.** `SessionStart` (на `startup|resume|clear|compact`) вставляє весь `using-n8n-mcp-skills/SKILL.md` у контекст **кожної** сесії через `additionalContext`; `PreToolUse` на інструменти `mcp__*__get_node`, `n8n_create_workflow`, `n8n_update_*`, `validate_workflow`, `n8n_test_workflow`, `n8n_instances`, `n8n_manage_credentials` додають нагадування; пишуть маркери в `$TMPDIR/n8n-mcp-skills-state` (`session-start.sh` ще створює порожню `~/.cache/n8n-mcp-skills`). Мережевих викликів у хуках немає | `hooks/hooks.json`, `grep -nE "curl|wget|npx|http" hooks -r` |
| MCP-сервери, API-ключі | **Так.** `mcp.json` підключає **віддалений** сервер третьої сторони `https://api.n8n-mcp.com/mcp`; локальний варіант вимагає `N8N_API_KEY` — повний API-доступ до інстансу n8n (створення, зміна, запуск воркфлоу, креденшели) | `mcp.json`, `.mcp.json.example`, `using-n8n-mcp-skills/SKILL.md` |
| `allowed-tools` | Немає | frontmatter усіх 15 `SKILL.md` |
| Команди під час рендеру `` !`cmd` `` | Немає (збіги `grep '!\`'` — це приклади операторів `!` у тексті) | `grep -rn '!\`' skills` |
| Інструкції щось завантажити / виконати | `npx`/`curl`/`wget` — 10 збігів: 7 у `n8n-self-hosting` (перевірка `healthz`, `curl -s ifconfig.me`, приклад credential overwrite — для людини, що розгортає n8n), приклад `curl -X POST …/webhook/form-submit` у `webhook_processing.md:401`, «Test API with Postman/curl first» у `http_api_integration.md:687` і `npx n8n-mcp` у `using-n8n-mcp-skills/SKILL.md:121` (запуск локального MCP-сервера) | `grep -rnE 'npx |curl |wget ' skills` |
| «Завжди вмикайся» | `using-n8n-mcp-skills`: «Always consult it first on **any** n8n, workflow, node, or automation task — even a quick one-off, and even when the user names no skill» — плюс хук `SessionStart`. Скіл претендує на кожну задачу, де є слово n8n | `description` у frontmatter, `hooks.json` |
| Посилання | 91 унікальне (docs.n8n.io, github, приклади `api.example.com`, `n8n.example.com`) | `grep -rhoE "https?://…" skills \| sort -u` |
| Приховані інструкції | Немає: збіги `system prompt` — у тексті про системний промпт AI-агентів n8n; 0 файлів із zero-width символами | `grep -rniE "ignore previous|system prompt|<!--"`, node-скрипт |
| Секрети в прикладах | Плейсхолдери `REPLACE_WITH_openssl_rand_base64_32` у `.env.*.example` | `grep -hE "PASSWORD|KEY|SECRET|TOKEN" assets/.env.*.example` |

## 3. Аудити

Джерело — те саме API, з якого бере дані skills CLI (`GET https://add-skill.vercel.sh/audit?source=czlonkowski/n8n-skills&skills=…`),
26.09.2026:

| Скіл | Gen (ATH) | Socket | Snyk | ZeroLeaks | Дати аналізу |
|---|---|---|---|---|---|
| `n8n-workflow-patterns` | safe | safe, 0 alerts, 90 | **medium** | safe, 93 | Gen/Socket/Snyk — 16.09.2026, ZeroLeaks — 16.04.2026 |
| `n8n-code-javascript` | safe | safe, 0 alerts, 90 | low | safe, 93 | Gen/Socket/Snyk — 16.09.2026, ZeroLeaks — 16.04.2026 |
| `using-n8n-mcp-skills` | safe | safe, 0 alerts, 90 | low | — | 16.09.2026 |

Аудит прив'язаний до пари «репозиторій + назва скіла», не до нашого SHA, і оцінює скіли — не хуки й не MCP-сервер
плагіна, які несуть основний ризик.

## 4. Ліцензія й походження

- **MIT** (`LICENSE`, `plugin.json`); частина файлів адаптована з офіційного `n8n-io/skills` під **Apache 2.0** — це
  чесно зазначено в `NOTICES` і `NOTICES-APACHE-2.0.txt`.
- Автор — Romuald Członkowski (AiAdvisors), він же автор MCP-сервера `n8n-mcp`. Репозиторій створено 20.10.2025, останній
  push 16.09.2026, 6323 зірки, 1043 форки — активний і популярний.

## 5. Чи правдивий зміст для нашого стеку — звірка з `materials/n8n-webhooks-brief.md`

| Твердження пакета (файл) | Що каже пакет | Що каже записка команди | Висновок |
|---|---|---|---|
| Перевірка підпису (`n8n-workflow-patterns/webhook_processing.md:124-136`, `:258-272`) | `if (signature !== expectedSig)` / `` if (signature !== `sha256=${calculatedSig}`) `` | Розділ 5, крок 5: порівняння довжин і `crypto.timingSafeEqual`, **не** `===` | ❌ Незахищене від атаки за часом порівняння — саме те, що ловить наш C10 |
| Що підписується (`webhook_processing.md:268`) | `.update(JSON.stringify($input.item.body))` | Крок 2: HMAC від **сирого** тіла; «повторна серіалізація змінює байти, і підпис не зійдеться» | ❌ Підпис рахується від переформатованого тіла — справжній підпис Stripe/GitHub не зійдеться |
| Режим для вузла Respond to Webhook (`webhook_processing.md:455-459`) | «Wrong: Webhook Response node with `responseMode: "onReceived"`… Correct: Set `responseMode: "lastNode"` to use Webhook Response node» | Розділ 8, крок 1: Respond — `Using 'Respond to Webhook' Node`; розділ 3: «When Last Node Finishes» — це вихід останнього вузла | ❌ Хибна порада: з `lastNode` вузол Respond to Webhook не керує відповіддю, 202 + колбек так не зібрати |
| Таймаут (`webhook_processing.md:421`) | «Webhook timeout: 120 seconds (default)» | Розділи 3, 4, 9: 120 с — це вікно **тестового** URL після «Listen for test event»; production-вебхук на n8n Cloud обривається **524 через 100 с** | ❌ Змішано два різні ліміти; за цією цифрою довгий воркфлоу «влізе» в синхронний режим і впаде з 524 |
| Токен у query (`webhook_processing.md:211`) | у прикладі структури даних вебхука — `"token": "abc"  // From URL: /webhook/form?token=abc`, без застереження | Розділ 1: секрет «ніколи не йде в query string»; розділ 11 — та сама пастка в прикладі Next.js | ⚠️ Це приклад, куди потрапляють query-параметри, а не порада; але токен у URL показано без застереження |
| Коди автентифікації (`n8n-error-handling/SKILL.md:150`) | «Auth missing or invalid → 401» | Розділ 8 і 11: вбудований **Header Auth** вебхука відповідає **403** «Authorization data is wrong!» | ⚠️ Таблиця про власні відповіді через Respond («Upstream check») — там 401 доречний; про вбудований Header Auth пакет нічого не стверджує. Ризик лише в тому, що агент перенесе «401» на Header Auth, який відповідає 403 |
| Секрет у Code-вузлі | `$credentials.webhookSecret` у Code node | Розділ 8, кроки 5–6: HMAC рахує вузол **Crypto** (v2) з Crypto credential; розділ 12: код для вузла Code — поза межами | ⚠️ Інший підхід; наш — нативний вузол без коду |

Що в пакеті корисне: `n8n-expression-syntax` (дані вебхука під `$json.body`, збігається з розділом 8 записки),
попередження, що `n8n_test_workflow` виконує справжні вузли й треба питати людину, `n8n-self-hosting` для власного
розгортання.

## 6. Закріплення версії (якби ставили)

- Не встановлюємо (див. вердикт). Якщо колись знадобиться окремий скіл (наприклад `n8n-expression-syntax`) —
  `npx skills@1.7.0 add "czlonkowski/n8n-skills#19cd793f4789e3ef9c657ccf26e097f641a77df0" --skill n8n-expression-syntax -a claude-code --copy`,
  **без** плагіна (хуки, `mcp.json`), з рев'ю діфу при кожному оновленні.

## Вердикт

**Не встановлювати в клієнтські проєкти.** Ризик — не в тексті скілів (аудити чисті, прихованих інструкцій немає), а в
плагіні: хук `SessionStart` вбудовує роутер у кожну сесію, а `mcp.json` підключає віддалений сервер третьої сторони
(`api.n8n-mcp.com`; інстанс n8n під'єднують через OAuth у його дашборді, локальний варіант — `npx n8n-mcp` з `N8N_API_KEY`).
З під'єднаним інстансом MCP отримує змогу створювати, змінювати й запускати воркфлоу та керувати креденшелами — а воркфлоу
клієнта за нашою запискою його власність, ми їх через API не змінюємо. Друге: у розділі про вебхуки пакет прямо суперечить контракту команди в чотирьох місцях (`!==` для
підпису, HMAC від `JSON.stringify`, `lastNode` для Respond to Webhook, «120 с» замість 100 с/524) — поряд з нашим
`integrating-n8n-webhooks` і з його «always consult it first» агент отримав би дві суперечливі інструкції. Окремі скіли на
кшталт `n8n-expression-syntax` можна брати як довідку людині, на закріпленому SHA, без хуків і MCP.
