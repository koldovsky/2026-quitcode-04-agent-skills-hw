# Webhook response modes and URLs

Read this when choosing how a workflow answers, or when a call returns 404 / 524.

## Response modes of the Webhook node

| Mode | What Next.js gets | When we use it |
|---|---|---|
| Immediately | 200 `{"message":"Workflow was started"}` right after the request arrives | Fire-and-forget events: `lead-created`, analytics |
| When Last Node Finishes | Output of the last node after the whole workflow | Quick lookups (seconds) whose result is needed in the response |
| Using 'Respond to Webhook' Node | Whatever the Respond to Webhook node sets (code, headers, body) | **Standard for long jobs:** 202 `{"job_id": …}` at once, result by callback |
| Streaming | A response stream | Not used |

**Rule:** anything that can approach **100 seconds** is async only (202 + callback). On n8n Cloud a
webhook that has not answered in 100 s ends with **524**; the workflow keeps running, but Next.js never
learns the result. If you do not know how long a workflow runs, it is async.

Respond to Webhook fires once; later such nodes are ignored. If the workflow finishes without reaching it,
n8n answers 200 with its default message; an error before it gives 500.

Status handling in `triggerWorkflow`:

| Mode | Success | Everything else |
|---|---|---|
| Immediately | 2xx | failure (retry only network/timeout/5xx/524) |
| Respond to Webhook (async) | exactly 202 and a non-empty `job_id` | failure — a 200 means the workflow never reached Respond to Webhook |
| When Last Node Finishes | 2xx, parse the result | failure |

## Test URL vs production URL

| | Test URL | Production URL |
|---|---|---|
| Path | `/webhook-test/<path>` | `/webhook/<path>` |
| Works | after «Listen for test event» in the editor (or a manual run), for **120 s** | while the workflow is **published** |
| Data visible in the editor | yes | no |

- Code and `.env.example` contain **only** `/webhook`. A test URL may go into your own `.env.local` for a
  few minutes while you watch data in the editor — never into git.
- n8n 2.x: publishing pins a workflow version; production calls go to that version, not to the latest
  edits. After changes — publish again.
- On self-hosted n8n the `webhook` / `webhook-test` path segments can be changed with
  `N8N_ENDPOINT_WEBHOOK` / `N8N_ENDPOINT_WEBHOOK_TEST`. If the client did that, record it in
  `docs/n8n-integrations.md` and put the real base into `N8N_WEBHOOK_BASE_URL`.

## Local mock

`scripts/mock-n8n.mjs` (copy of the project's `tools/mock-n8n.mjs`) behaves like Webhook, Respond to
Webhook and a signed HTTP Request callback. Commands are the same in Git Bash and PowerShell:

```bash
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --help
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs                     # :5678, Immediately
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode last-node    # answer after 2 s
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode slow --cloud-timeout 5000   # 524 like Cloud
node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000
#   N8N_WEBHOOK_TOKEN in .env.local → Header Auth (x-n8n-token required, else 403)
#   N8N_CALLBACK_SECRET → signed callback to the request's callbackUrl after 5 s
```

- Test URLs work only with `--listen`, for 120 s — like n8n.
- The mock log shows method, path, status, duration, header **names**, body size and sha256,
  `auth=ok|missing|wrong|none` and `idempotency=new|repeat|absent`; never bodies or values.
- The mock also sends a callback in `immediately` mode (after `--delay`), like a workflow that reports back.
