# Інтеграції з n8n

Контракт — скіл `.claude/skills/integrating-n8n-webhooks`. Один рядок на подію.

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately (200 одразу), колбека немає; виклик в `after()` | клієнт (воркфлоу CRM), агенція (код) |
| `quote-request` | Next.js → n8n, колбек n8n → `POST /api/n8n/quote-request` | `/webhook/quote-request` | асинхронно: 202 + підписаний колбек (воркфлоу 40–90 с) | клієнт (воркфлоу), агенція (код) |

## quote-request

- Запуск: Server Action `requestQuote` (`app/quotes/actions.ts`) зберігає запит (`queued`), редіректить на
  `/quotes/<id>` і викликає n8n в `after()`.
- `data`: `quoteId`, `company`, `description`, `budget`. `budget` — число доларів, до 2 знаків після коми
  (`1500`, `1500.5`), або `null`, якщо поле порожнє. Email клієнта в n8n **не** передаємо — воркфлоу
  листів не надсилає. Якщо знадобиться — додати поле й записати рішення тут.
- Колбек: `quote-request.completed` з `result.documentUrl` (лише `https://`) → `ready`;
  `quote-request.failed` → `failed`. Суфікс `event` має збігатися з `data.status`, інакше 400. `sent`/`failed`
  з боку застосунку записується лише зі стану `queued` в одній операції, тож готовий кошторис не повертається в `sent`.
  `ready` — кінцевий: колбек `failed` іншого запуску воркфлоу (новий `jobId`) приймається (202), але статус не
  змінює. Застовплені ключі колбеків зберігаються добу.

## lead-created

- Запуск: Server Action `submitLead` (`app/actions.ts`) зберігає лід і викликає n8n в `after()` через
  `lib/n8n/client.ts`. Відвідувач n8n не чекає.
- `idempotency-key`: `lead-created:<lead.id>`, виводиться із запису, тож повтор того самого ліда n8n впізнає.
- `data`: `leadId`, `firstName`, `lastName`, `email`, `phone`, `company`, `website`, `message`,
  `consentMarketing`, тобто лише те, що потрібно CRM. **Змінено** проти старого коду: раніше йшов увесь запис
  ліда (IP, user agent, `rawPayload`, службові поля), конвертом `{ version: 1, event, data }` він не був.
  Це зміна формату для воркфлоу клієнта. Її треба погодити з власником воркфлоу до деплою (правило зупинки
  скіла). Локально перевірено на моку.
- Якщо n8n не прийняв лід (4xx, або мережа / 5xx після 2 повторів), у журнал аудиту пишеться `lead.n8n_failed`
  з id ліда. Такі ліди можна надіслати ще раз з тим самим `idempotency-key`.
