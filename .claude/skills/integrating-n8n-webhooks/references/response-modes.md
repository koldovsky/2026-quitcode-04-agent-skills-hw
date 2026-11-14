# Режими відповіді Webhook і URL

## Режими

| Режим (Respond) | Що отримує Next.js | Коли |
|---|---|---|
| Immediately | 200 одразу після отримання запиту | подія «до відома»: `lead-created`, аналітика |
| When Last Node Finishes | вихід останнього вузла після завершення | швидка довідка (секунди), результат потрібен у відповіді |
| Using 'Respond to Webhook' Node | те, що задає Respond to Webhook | **стандарт для довгих задач:** 202 `{"job_id": …}` одразу, результат — колбеком |
| Streaming | потік | не використовуємо |

**Правило:** усе, що може наблизитись до **100 с**, — тільки асинхронно (202 + колбек). На n8n Cloud
вебхук, що не відповів за 100 с, завершується **524**, а воркфлоу працює далі — Next.js про результат
уже не дізнається. Тривалість невідома — значить асинхронно.

Respond to Webhook спрацьовує один раз (наступні ігноруються). Воркфлоу завершився, не дійшовши до
нього, — n8n відповідає 200 зі стандартним повідомленням; помилка до нього — 500.

## Тестовий і production URL

| | Тестовий | Production |
|---|---|---|
| Шлях | `/webhook-test/<path>` | `/webhook/<path>` |
| Коли працює | 120 с після «Listen for test event» | поки воркфлоу **опублікований** |
| Дані видно в редакторі | так | ні |

- У коді й `.env.example` — **лише** `/webhook`. Тестовий URL — тимчасово і тільки у власному
  `.env.local`, коли дивитесь дані в редакторі n8n. Інакше заявки мовчки губляться, щойно хтось закриє
  редактор.
- n8n 2.x: публікація фіксує версію воркфлоу; production-виклики йдуть у неї, а не в останні правки.
  Після змін — Publish знову.
- На self-hosted шляхи можна змінити (`N8N_ENDPOINT_WEBHOOK`, `N8N_ENDPOINT_WEBHOOK_TEST`) — тоді це
  записуємо в `docs/n8n-integrations.md`.

## Мок для локальної розробки

`scripts/mock-n8n.mjs` поводиться як Webhook + Respond to Webhook + HTTP Request з підписом:

```bash
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --help
node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode slow --cloud-timeout 5000   # 524, як Cloud
```

З `N8N_WEBHOOK_TOKEN` мок вимагає `x-n8n-token` (інакше 403), з `N8N_CALLBACK_SECRET` — через
`--delay` мс надсилає підписаний колбек на `callbackUrl` із тіла. `/webhook-test/` — лише з `--listen`
і лише 120 с. У журналі мока: шлях, статус, тривалість, імена заголовків, розмір і sha256 тіла,
`auth=ok|missing|wrong|none`, `idempotency=new|repeat|absent`, рядки `callback POST … -> <код>`.
