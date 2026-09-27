# n8n integrations

| Event | Direction | Path | Mode | Owner |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n | `POST {N8N_WEBHOOK_BASE_URL}/quote-request` | async: 202 + signed callback | Studio Nova |
| `quote-request.completed` / `.failed` | n8n → Next.js | `POST /api/n8n/quote-request` | signed callback (HMAC-SHA256) | Studio Nova |

## quote-request (PDF quote)

- Trigger: Server Action `requestQuote` (`app/quotes/actions.ts`) saves a `queued` quote, then calls
  `triggerWorkflow` inside `after()` — the user never waits for the 40–90 s workflow.
- Request envelope `{ version: 1, event, data, callbackUrl }`; `data` is the minimum the workflow
  needs (`quoteId`, `company`, `budget`, `description`) — never the full record, email or notes.
- The workflow answers **202** and later `POST`s a signed callback to `callbackUrl`.
- Callback route `app/api/n8n/[event]/route.ts` verifies timestamp + HMAC signature, deduplicates by
  the `idempotency-key` header (`<jobId>:<body event>`), matches our record by
  `requestIdempotencyKey`, and sets the quote to `ready` (with `documentUrl`) or `failed`.
- Status page `/quotes/[id]` reads our own record; it never calls n8n. It auto-refreshes while
  `queued`.

n8n-side settings to hand to the client: `.claude/skills/integrating-n8n-webhooks/references/n8n-setup.md`.
