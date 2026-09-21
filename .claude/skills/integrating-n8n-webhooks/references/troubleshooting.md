# Симптом → причина → що робити

| Симптом | Найімовірніша причина | Що робити |
|---|---|---|
| **404** від n8n, `The requested webhook "…" is not registered` | Тестовий URL `/webhook-test/…` (живе 120 с після «Listen for test event») або воркфлоу не опубліковано | У коді й `.env*` — `/webhook/…`; у n8n — Publish |
| 404 від n8n, `…not registered for GET requests` | Не той HTTP-метод | Контракт — лише `POST` |
| **403** `Authorization data is wrong!` | Header Auth: немає `x-n8n-token` або значення не збігається з credential | Звір `N8N_WEBHOOK_TOKEN` з Value credential; ім'я заголовка — рівно `x-n8n-token` |
| **524** через 100 с (n8n Cloud) | Синхронний запит до довгого воркфлоу (When Last Node Finishes) | Respond to Webhook 202 + колбек (response-modes.md) |
| `TimeoutError` у журналі Next.js | n8n не відповів за 10 с — в async-режимі це збій, не «повільний воркфлоу» | Перевір, чи Respond to Webhook стоїть одразу після Remove Duplicates |
| `ECONNREFUSED` при виклику n8n | Мок/n8n не запущено, не той порт, або `localhost` усередині Docker | Запусти мок; у Docker — `host.docker.internal`; спробуй `127.0.0.1` замість `localhost` (IPv6 `::1`) |
| `ECONNREFUSED` у журналі мока при колбеку | Застосунок не запущено або `APP_BASE_URL`/`--callback-url` вказує не туди | Перевір адресу і що `npm start` працює |
| Колбек → **401** «підпис не збігається» | Роут читає `request.json()` і підписує `JSON.stringify(...)` заново; n8n шле «JSON → Fields», а не Raw; різні секрети; годинник поза ±300 с | Сирі байти до перевірки; у n8n Body Content Type = Raw; той самий секрет в обох місцях; синхронізація часу |
| Колбек → **500** на все | На сервері не задано `N8N_CALLBACK_SECRET` | Додай у `.env.local` / налаштування хостингу, перезапусти |
| Колбек → **415** | n8n шле не `application/json` | HTTP Request → Raw, Content Type `application/json` |
| Колбек → **413** | У колбеку файл або великий масив | Лише посилання на файл |
| Колбек → **404** «unknown job» | `requestIdempotencyKey` не той (n8n узяв не той заголовок) або запис видалено | `{{ $('Webhook').item.json.headers['idempotency-key'] }}` |
| Колбек → **400** «idempotency-key does not match the signed body» | Заголовок `idempotency-key` в HTTP Request зібрано не з тих полів (інший `$execution.id` чи інша подія), ніж тіло | `{{ $execution.id }}:<event>.completed`, і в тілі `data.jobId` = `{{ $execution.id }}` |
| Запис оновився **двічі** / два листи | Немає ідемпотентності: повтори без `idempotency-key`, у n8n немає Remove Duplicates, роут не «застовплює» ключ | Ключ на кожен виклик, Remove Duplicates у n8n, claim у роуті |
| Статус завис на `queued` | Виклик n8n не відбувся: немає `N8N_WEBHOOK_BASE_URL`/`N8N_WEBHOOK_TOKEN`/`APP_BASE_URL` або 4xx | Журнал сервера: рядок `n8n → <event>` з кодом і причиною |
| Статус завис на `processing` | Колбек не прийшов: воркфлоу впав, не той `callbackUrl`, опублікована стара версія | Executions у n8n; Publish; `callbackUrl` = `${APP_BASE_URL}/api/n8n/<event>` |
| Форма «думає» кілька секунд | Server Action чекає n8n замість `after()` | Виклик n8n — в `after()`; дія повертає `{ status, id }` одразу |
| Зміни у воркфлоу «не працюють» | n8n 2.x виконує опубліковану версію | Publish після кожної зміни |
| `import "server-only"` → помилка збірки в Client Component | Клієнтський компонент імпортує `lib/n8n/*` | Виклик — через Server Action, не з клієнта |
