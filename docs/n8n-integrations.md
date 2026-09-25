# Інтеграції з n8n

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately (до відома) | Maria Vorobets |
| `quote-request` | Next.js → n8n → колбек | `/webhook/quote-request` | Respond to Webhook 202 + колбек `/api/n8n/quote-request` | Maria Vorobets |
