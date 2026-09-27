# Режим відповіді вебхука й тестовий/production URL

## Режими вузла Webhook

| Режим | Що отримує Next.js | Коли використовуємо |
|---|---|---|
| Immediately | 200 `{"message":"Workflow was started"}` одразу | Подія «до відома», результат не потрібен: `lead-created`, аналітика |
| When Last Node Finishes | Вихід останнього вузла після завершення воркфлоу | Швидкий запит довідки (секунди), коли результат потрібен у відповіді |
| Using Respond to Webhook | Те, що задає вузол Respond to Webhook | **Стандарт для довгих задач:** 202 `{"job_id": …}` одразу, результат — колбеком |
| Streaming | Потік | Не використовуємо |

**Правило 100 секунд.** Усе, що може наблизитися до 100 с, — лише асинхронно (202 + колбек). На
n8n Cloud запит, на який вебхук не відповів за 100 с, завершується кодом **524**; воркфлоу працює
далі, а Next.js про результат уже не дізнається. Якщо не певні, скільки триває воркфлоу, — він
асинхронний. Приклад: генерація PDF-кошторису 40–90 с → тільки 202 + колбек.

- Respond to Webhook спрацьовує один раз; наступні такі вузли ігноруються.
- Воркфлоу завершився, не дійшовши до Respond to Webhook → n8n відповідає 200 зі стандартним
  повідомленням; помилка до нього → 500. Тому 200 без `job_id` в асинхронній події — збій
  налаштування, а не успіх.

## Що робить клієнт за кодом відповіді

| Код | Значення | Дія |
|---|---|---|
| 200 (Immediately) | воркфлоу запущено | готово |
| 202 `{job_id}` | асинхронний запуск | зберегти `jobId`, статус `processing`, чекати колбек |
| 403 | неправильний/відсутній `x-n8n-token` (Header Auth) | не повторювати; `failed`, перевірити токен |
| 404 | воркфлоу не опубліковано, неправильний шлях, або тестовий URL без «Listen» | не повторювати; `failed` |
| 5xx, 524, мережа, `TimeoutError` | тимчасовий збій | повтор (≤ 2, 1 с / 3 с, той самий ключ) |

## Тестовий і production URL

| | Тестовий URL | Production URL |
|---|---|---|
| Шлях | `/webhook-test/<path>` | `/webhook/<path>` |
| Коли працює | Після «Listen for test event» у редакторі, **120 секунд** | Поки воркфлоу **опублікований** |
| Дані видно в редакторі | Так | Ні |

- У коді й у `.env.example` — **лише** `/webhook`. Тестовий URL — тільки тимчасово у власному
  `.env.local`, коли дивитесь дані в редакторі n8n. Інакше заявки мовчки губляться, щойно хтось
  закриє редактор.
- n8n 2.x: публікація фіксує версію воркфлоу; production-виклики йдуть у неї. Після змін —
  опублікувати знову.
- Шляхи `webhook`/`webhook-test` на self-hosted змінюються змінними `N8N_ENDPOINT_WEBHOOK` /
  `N8N_ENDPOINT_WEBHOOK_TEST`. Якщо клієнт це зробив — запишіть у `docs/n8n-integrations.md`.

## Локально: мок

`scripts/mock-n8n.mjs` (`--help`) поводиться як Webhook + Respond to Webhook + підписаний HTTP Request:

```bash
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs                        # Immediately
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode last-node      # відповідь через 2 с
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode slow --cloud-timeout 5000   # 524
node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000
#   з N8N_WEBHOOK_TOKEN — Header Auth (403 без токена), з N8N_CALLBACK_SECRET — підписаний колбек через 5 с
```

`/webhook-test/<path>` мок приймає лише з `--listen` і лише 120 с. Журнал мока показує метод, шлях,
статус, тривалість, **імена** заголовків, розмір і sha256 тіла, `auth=ok|missing|wrong|none`,
`idempotency=new|repeat|absent` — за ним видно, чи виконано контракт.
