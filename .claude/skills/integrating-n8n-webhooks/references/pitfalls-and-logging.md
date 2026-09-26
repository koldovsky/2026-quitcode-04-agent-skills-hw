# Журнали, ліміти, відомі пастки

## Журнали

| Пишемо | Не пишемо ніколи |
|---|---|
| подію, напрям, `x-correlation-id` | тіло запиту чи відповіді |
| код статусу, тривалість, номер спроби | ім'я, email, телефон, IP клієнта |
| довжину тіла і його sha256 | токен, підпис, секрет, повний URL з query string |

Відповіді з помилкою не містять внутрішніх подробиць (стек, SQL, URL n8n).

## Ліміти

| Ліміт | Значення | Джерело |
|---|---|---|
| Тіло запиту до вебхука n8n | 16 МБ (`N8N_PAYLOAD_SIZE_MAX`, на self-hosted можна змінити) | [webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) |
| Тіло Server Action | 1 МБ за замовчуванням (`serverActions.bodySizeLimit`) | [server actions](https://nextjs.org/docs/app/guides/server-actions) |
| Відповідь вебхука на n8n Cloud | 100 с, далі 524 | [common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) |
| Тестовий URL | 120 с після «Listen for test event» | [workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/) |
| Колбек у Next.js | 64 КБ, вікно часу 300 с | наше рішення |

Файли не передаємо — лише посилання на них.

## Відомі пастки в документації й чужих скілах

- «Workflow got started» (документація) проти `Workflow was started` (код n8n) — тому
  текст відповіді не парсимо, лише код статусу.
- Офіційний пакет скілів n8n пише, що Header Auth відхиляє запит з **401**; код n8n
  повертає **403** («Authorization data is wrong!»). 401 — для Basic Auth і JWT.
- Той самий пакет пише, що секрет вузла Crypto не прив'язується до credential. Для
  Crypto v2 це вже не так: документація й код використовують Hmac Secret із Crypto
  credential.
- Приклад вебхука в документації Next.js передає токен у `?token=` у GET-запиті й
  порівнює через `!==`. Той самий гайд попереджає, що GET-запити можуть кешуватись і
  потрапляти в журнали. Ми робимо суворіше: токен у заголовку, підпис і
  `timingSafeEqual`.

## Поза межами цього скіла

- Побудова й зміна воркфлоу в редакторі n8n, експорт чи імпорт JSON воркфлоу.
- Код для вузла Code в n8n.
- Черги й фонові воркери: для наших об'ємів вистачає `after()` і колбеків.

## Реєстр інтеграцій проєкту (рекомендовано)

Кожна інтеграція — рядок у `docs/n8n-integrations.md` проєкту:

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек | ім'я відповідального |
