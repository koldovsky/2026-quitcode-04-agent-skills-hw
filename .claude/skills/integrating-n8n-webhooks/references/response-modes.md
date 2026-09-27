# Режим відповіді n8n і URL вебхука

## Режими вузла Webhook

([webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/),
[Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/))

| Режим | Що отримує Next.js | Коли використовуємо |
|---|---|---|
| Immediately | 200 одразу після отримання запиту | Подія «до відома», результат не потрібен: `lead-created`, аналітика |
| When Last Node Finishes | Вихід останнього вузла після завершення воркфлоу | Швидкий запит довідки (секунди), коли результат потрібен у відповіді |
| Using Respond to Webhook | Те, що задає вузол Respond to Webhook (код, заголовки, тіло) | **Стандарт для довгих задач:** 202 `{"job_id": …}` одразу, результат — колбеком |
| Streaming | Потік відповіді | Не використовуємо |

## Правило вибору

Усе, що може наблизитись до **100 секунд**, — лише асинхронно (202 + колбек). На n8n
Cloud запит без відповіді за 100с завершується кодом **524**
([common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/)).
Воркфлоу при цьому працює далі, а Next.js про результат уже не дізнається.

**Якщо не певні, скільки триває воркфлоу — він асинхронний.**

Respond to Webhook спрацьовує один раз; наступні такі вузли ігноруються. Якщо воркфлоу
завершився, не дійшовши до нього, n8n відповідає 200 зі стандартним повідомленням;
помилка до нього — 500.

## Тестовий і production URL

| | Тестовий URL | Production URL |
|---|---|---|
| Шлях | `/webhook-test/<path>` | `/webhook/<path>` |
| Коли працює | Після «Listen for test event» у редакторі (або запуску воркфлоу), 120 секунд | Поки воркфлоу опублікований |
| Дані видно в редакторі | Так | Ні |

([workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/))

- У коді й у `.env.example` — **лише** `/webhook`. Тестовий URL можна тимчасово
  поставити тільки у власний `.env.local`, коли дивишся дані в редакторі n8n.
- n8n 2.x: публікація фіксує конкретну версію воркфлоу, production-виклики йдуть у неї,
  а не в останні правки. Після змін — опублікувати знову
  ([save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows)).
- Шляхи `webhook`/`webhook-test` на self-hosted n8n можна змінити змінними
  `N8N_ENDPOINT_WEBHOOK` / `N8N_ENDPOINT_WEBHOOK_TEST`
  ([endpoints](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints)).
  Якщо клієнт це зробив — записати в `docs/n8n-integrations.md` проєкту.