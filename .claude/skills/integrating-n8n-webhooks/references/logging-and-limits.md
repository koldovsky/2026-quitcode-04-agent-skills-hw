# Журнали й ліміти

## Що можна писати в журнал, а що ніколи

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
| Відповідь вебхука на n8n Cloud | 100с, далі 524 | [common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) |
| Тестовий URL | 120с після «Listen for test event» | [workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/) |
| Колбек у Next.js | 64 КБ, вікно часу 300с | рішення команди |

Файли не передаємо — лише посилання на них.

## Поза межами скіла

- Побудова й зміна воркфлоу в редакторі n8n, експорт чи імпорт JSON воркфлоу.
- Код для вузла Code в n8n.
- Черги й фонові воркери: для наших об'ємів вистачає `after()` і колбеків.