# Режими відповіді вузла Webhook і ліміти

## Чотири режими

| Режим (Respond) | Що отримує Next.js | Коли використовуємо |
|---|---|---|
| Immediately | 200 одразу після отримання запиту (`{"message":"Workflow was started"}` — текст не парсимо) | Подія «до відома», результат не потрібен: `lead-created`, аналітика |
| When Last Node Finishes | Вихід останнього вузла, коли воркфлоу завершився | Швидка довідка (секунди), результат потрібен у відповіді |
| Using 'Respond to Webhook' Node | Те, що задає вузол Respond to Webhook: код, заголовки, тіло | **Стандарт для довгих задач**: 202 `{"job_id": …}` одразу, результат — колбеком |
| Streaming | Потік відповіді | Не використовуємо |

Джерела: [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/),
[Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/).

**Правило вибору:**
1. Результат не потрібен → Immediately.
2. Результат потрібен і воркфлоу гарантовано займає секунди → When Last Node Finishes.
3. Інакше (довго, невідомо скільки, зовнішні API, генерація файлів, LLM) → Respond to Webhook 202 +
   колбек. **Якщо не певен, скільки триває воркфлоу, — він асинхронний.**

Навіть для режиму 2 користувач не має чекати n8n у Server Action довше, ніж треба: Next.js виконує
Server Actions **по одній на клієнта** — довге очікування блокує наступну дію того ж користувача
([Server Actions](https://nextjs.org/docs/app/guides/server-actions)).

## Поведінка, яку треба знати

- Respond to Webhook спрацьовує **один раз**; наступні такі вузли ігноруються. Якщо воркфлоу
  завершився, не дійшовши до нього, n8n відповідає 200 зі стандартним повідомленням; помилка до нього → 500.
- Документація для Immediately пише «Workflow got started», а код n8n повертає
  `{"message":"Workflow was started"}` — тому дивимось лише на код статусу.
- Header Auth відхиляє неправильний чи відсутній токен кодом **403** «Authorization data is wrong!»
  (401 — для Basic Auth і JWT).

## Ліміти

| Ліміт | Значення | Джерело |
|---|---|---|
| Відповідь вебхука на n8n Cloud | **100 с**, далі **524** (воркфлоу працює далі, але Next.js результату не дізнається) | [common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) |
| Тестовий URL `/webhook-test/…` | активний **120 с** після «Listen for test event» | [workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/) |
| Production URL `/webhook/…` | поки воркфлоу **опублікований**; n8n 2.x виконує опубліковану версію, не останні правки | [save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows) |
| Тіло запиту до вебхука | 16 МБ (`N8N_PAYLOAD_SIZE_MAX`, self-hosted можна змінити) | [webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) |
| Тіло Server Action | 1 МБ за замовчуванням (`serverActions.bodySizeLimit`) | [server actions](https://nextjs.org/docs/app/guides/server-actions) |
| Колбек у Next.js | 64 КБ, вікно часу ±300 с | рішення команди |
| Таймаут нашого виклику n8n | 10 с на спробу (`AbortSignal.timeout(10_000)`) | рішення команди: в async-режимі n8n відповідає одразу, довго = збій |

Файли не передаємо в жодному напрямку — лише посилання на них.

## Як це відтворити на моку

```bash
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode immediately
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode last-node          # 2 с
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode slow --cloud-timeout 5000   # 524
node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --listen                  # /webhook-test/ на 120 с
```
