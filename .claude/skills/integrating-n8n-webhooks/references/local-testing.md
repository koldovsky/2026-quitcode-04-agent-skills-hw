# Local testing: the mock, the contract check, the callback matrix

Three zero-dependency Node scripts in `scripts/`. They behave the same in Git Bash, PowerShell and
macOS. The ones that need secrets read them from the environment (`node --env-file=.env.local …`)
and never print them. Paths below are from the project root.

## Contents

1. `mock-n8n.mjs`: an offline n8n
2. Scenarios with the mock
3. `check-contract.mjs`: static contract check
4. `send-signed-callback.mjs`: the callback matrix
5. The human's part

## 1. `mock-n8n.mjs`: an offline n8n

A copy of LeadDesk's `tools/mock-n8n.mjs`, so the skill also works in other projects. Its `--help`
still says `node tools/mock-n8n.mjs`; from the skill it is:

```bash
node .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --help
node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000
```

- It behaves like the Webhook, Respond to Webhook and a signing HTTP Request node, on
  `http://127.0.0.1:5678`, so `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`.
- With `N8N_WEBHOOK_TOKEN` in its environment it requires `x-n8n-token` (else 403). With
  `N8N_CALLBACK_SECRET` it sends a signed callback to the request's `callbackUrl` (async modes),
  retrying 3 × 1000 ms on network errors and 5xx.
- `/webhook-test/<path>` answers only with `--listen`, and only for 120 s, like n8n.
- If the app runs on another port, pass `--callback-url http://127.0.0.1:<port>/api/n8n/<event>`.

**Reading its log** (one line per request, never bodies or header values):

```
POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: content-type,idempotency-key,x-correlation-id,x-n8n-token | body 160 B sha256=…
callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 34 ms (try 1/3) event=quote-request.completed …
```

- `/webhook/` vs `/webhook-test/`: production vs test URL.
- `auth=ok|wrong|missing|none`: Header Auth result (`none` = the mock has no token set).
- `idempotency=new|repeat|absent`: `repeat` on a retry is correct; `new` on every retry means the
  key is generated per attempt; `absent` means the header is missing.
- `headers:` names only. `idempotency-key`, `x-correlation-id` and `x-n8n-token` must be there.
- `callback … -> 202`: the app accepted the signed callback. `-> 401` means a signature or clock
  problem, `-> 200` the key was already claimed.

## 2. Scenarios with the mock

| What to prove | Mock | Expect |
|---|---|---|
| The form doesn't wait for n8n | `--mode last-node` (answers after 2 s) | The form answers in well under 2 s; mock log `-> 200 in ~2000 ms` |
| Async flow end to end | `--env-file=.env.local … --mode respond-202 --delay 5000` | `-> 202 … auth=ok idempotency=new`, ~5 s later `callback POST … -> 202`, status page shows the result |
| Why long workflows can't be synchronous | `--mode slow --cloud-timeout 5000` | A synchronous caller gets 524 after 5 s while "the workflow keeps running" |
| Retries use one key | `--mode slow --cloud-timeout 800` | Three lines `-> 524`: `idempotency=new`, `repeat`, `repeat`, ~1 s and ~3 s apart |
| Header Auth | token set for the mock, a different one in the app | `-> 403 … auth=wrong`, the client does not retry |
| Test URLs die | `/webhook-test/…` without `--listen` | 404: never use them in code |

## 3. `check-contract.mjs`: static contract check

```bash
node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs                          # whole project
node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ../other-copy      # another folder
node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --changed-since <git-ref>  # only your changes
node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --help
```

| Id | Checks |
|---|---|
| C1 | no `/webhook-test/` in code or `.env.example` |
| C2 | no `NEXT_PUBLIC_` n8n variables; Client Components don't touch `N8N_*` or `lib/n8n` |
| C3 | `.env.example` declares the contract variables: base URL on `/webhook`, local URLs, `change-me-…` secrets, no other `N8N_*` names |
| C4 | n8n is called only from `lib/n8n/client.ts`; callback routes live under `app/api/n8n/` |
| C5 | `lib/n8n` modules with config start with `import "server-only"` |
| C6 | every fetch to n8n has `signal: AbortSignal.timeout(…)` |
| C7 | `x-n8n-token` (from env), `idempotency-key`, `x-correlation-id`, `application/json`, the `{version, event, data}` envelope; no secrets in query strings |
| C8 | Server Actions start n8n only inside `after()` |
| C9 | no `runtime = "edge"` |
| C10 | callback route: 404/415 checks, `request.text()`, 413, no `request.json()` / `JSON.parse` before the signature check |
| C11 | callback route: HMAC-SHA256, `sha256=` format, length check + `timingSafeEqual`, no `===` on signatures |
| C12 | callback route: HMAC over `${timestamp}.${raw}`, a two-sided 300 s window, 401 |
| C13 | callback route: `idempotency-key` claimed, 200 `duplicate`, key == `${jobId}:${event}`, released on failure |
| C14 | n8n code logs no bodies, personal data, secrets, `process.env` or whole error objects |

- Every check prints `PASS`, `FAIL` (with `file:line` and what to change) or `SKIP` (the project has
  nothing of that kind, e.g. no callback route yet). Exit code 1 on any FAIL.
- `--changed-since <ref>` reports only findings on lines changed since `ref` (plus new untracked
  files). Use it to separate your changes from old code, and still report FAILs in old code instead
  of hiding them.
- It is static: it reads code, it doesn't run it. It can't see what a helper in another file does,
  or whether a value is really minimal. The checklist and the mock cover the rest.

## 4. `send-signed-callback.mjs`: the callback matrix

With the app running:

```bash
node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request
```

| Id | Case | Expected |
|---|---|---|
| R1 | unknown event path | 404 |
| R2 | `content-type: text/plain` | 415 |
| R3 | body over 64 KB, correctly signed | 413 |
| R4 | no `x-n8n-signature` | 401 |
| R5 | signed with another secret | 401 |
| R6 / R7 | timestamp 301 s in the past / future | 401 |
| R8 | body re-serialized after signing | 401 |
| R9 | `idempotency-key` ≠ `<jobId>:<event>` | 400 |
| R10 | body event of another path | 400 |
| R11 | unknown job, twice with one key | the same 4xx twice, never 200 "duplicate" (key released) |
| V1–V3 | with `--request-key <key of a real record>`: valid → 202, repeat → 200 duplicate, same bytes under a new key → 400 | |

V1 changes that record's state. The idempotency key of a record isn't shown anywhere by design.
The happy path is also proven by the mock's own callback (`callback POST … -> 202`).

## 5. The human's part

The agent doesn't read `.env*` files. For the mock scenarios, the human:

1. adds the four variables to `.env.local` (values: `change-me-…` locally, or generated ones),
   and restarts `npm run dev` / `npm start` (env is read at startup);
2. starts the mock in a second terminal with `node --env-file=.env.local …`;
3. submits the form and opens the status page.

The agent can run `check-contract.mjs`, `npm run lint` and `npm run build` itself, and tell the
human exactly which commands to run for the rest and what the log lines should say.
