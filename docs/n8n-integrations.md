# n8n integrations

Contract: `.claude/skills/integrating-n8n-webhooks`. One row per event.

| event | direction | n8n path | mode | owner |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → callback `/api/n8n/quote-request` | `/webhook/quote-request` | Respond to Webhook 202 `{job_id}` + signed callback (workflow runs 40–90 s) | _TBD_ |
| `lead-created` | Next.js → n8n | ⚠️ only a test URL is known (`/webhook-test/lead-created`) | Immediately (fire-and-forget) | _TBD_ |

## quote-request

- Trigger: Server Action `requestQuote` (`app/quotes/actions.ts`) from `/quotes/new`; the n8n call runs in
  `after()`, the user is redirected to `/quotes/[id]` at once.
- Request `data`: `quoteId`, `company`, `email`, `description`, `budget` (USD, integer).
- `idempotency-key`: `Quote.idempotencyKey`, created once per quote. Success = exactly `202` with `job_id`,
  stored as `Quote.jobId`.
- Callback: `POST /api/n8n/quote-request`, body event `quote-request.completed`,
  `data.status` = `completed` (`result.documentUrl` — an `https://` link to the PDF) or `failed`
  (`error.code`). Matched by `data.jobId`, or by `data.requestIdempotencyKey` if the callback arrives
  before the 202 is processed.
- Quote statuses: `queued` → `processing` → `ready` | `failed`. `failed` without a callback means n8n was
  not reached or did not answer 202.
