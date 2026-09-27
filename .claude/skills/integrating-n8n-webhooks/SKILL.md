---
name: integrating-n8n-webhooks
description: >-
  Team contract for connecting a Next.js 16 app to n8n workflows: triggering a workflow webhook
  from a Server Action or Route Handler (server-only client, Header Auth token, idempotency key,
  timeout and retries, async 202 + callback via after()) and receiving n8n callbacks in a Route
  Handler (raw body, HMAC signature with timingSafeEqual, timestamp window, idempotency). Includes
  a static contract checker and an offline n8n mock.
  Use when code sends data to n8n or receives results from n8n: "start the workflow", "trigger n8n",
  "send the lead/quote to n8n", "webhook for n8n", "endpoint that n8n calls when the result is ready",
  "callback from the workflow", "запусти воркфлоу", "виклик n8n", "вебхук n8n", "колбек від n8n",
  "n8n повідомить, коли готово", N8N_* environment variables, a workflow that takes seconds or minutes.
  Not for: building or editing workflows in the n8n editor, exporting/importing workflow JSON,
  or writing code for the n8n Code node.
metadata:
  owner: studio-nova-web
  version: "0.1.0"
---

# Integrating n8n webhooks

Client projects are Next.js front-ends over n8n workflows the client already runs. This skill is
the team's agreed contract for both directions, so every project calls n8n the same way and never
loses, duplicates or leaks a request. Deviations only consciously and in writing (PR description).

```
Next.js  lib/n8n/client.ts ── POST {N8N_WEBHOOK_BASE_URL}/<event> ──▶ n8n Webhook (Header Auth)
         (Server Action → after())  x-n8n-token, idempotency-key,       └ Respond to Webhook: 202 {job_id}
                                    x-correlation-id                        … workflow …
         app/api/n8n/[event]/route.ts ◀── POST signed callback ───── HTTP Request node
                                    x-n8n-timestamp, x-n8n-signature, idempotency-key
```

## When to use

- Any code that calls an n8n webhook or receives a call from n8n, and any `N8N_*` variable.
- **Not**: designing the workflow itself in n8n, workflow JSON, n8n Code-node scripts
  (the client owns the workflow; we hand over settings as text — see `references/n8n-setup.md`).

## The contract in short

1. **Env, server-only:** `N8N_WEBHOOK_BASE_URL` (ends with `/webhook`), `N8N_WEBHOOK_TOKEN`,
   `N8N_CALLBACK_SECRET`, `APP_BASE_URL`. Never `NEXT_PUBLIC_`. Real values only in `.env.local`;
   `.env.example` has `change-me-…` secrets and local URLs. → `references/contract.md` §Env
2. **One client module** `lib/n8n/client.ts`, first line `import "server-only"`. No `fetch` to n8n
   anywhere else.
3. **Request:** `POST ${N8N_WEBHOOK_BASE_URL}/<event>` (kebab-case, one path per event); headers
   `content-type: application/json`, `x-n8n-token`, `idempotency-key` (UUID created **once** per
   business operation and stored with the record), `x-correlation-id`. Body is the envelope
   `{ version: 1, event, data, callbackUrl? }`; `data` is the minimum the workflow needs — never the
   whole DB row, IP, user agent or notes. → `references/contract.md` §Request
4. **Timeout & retries:** each attempt `signal: AbortSignal.timeout(10_000)`; at most 2 retries
   (1 s, then 3 s) **only** on network error, timeout, 5xx/524 — always the same `idempotency-key`.
   No retry on 4xx (403 wrong token, 404 unpublished workflow or test URL). Judge the response by
   **status code only**, never by its message text.
5. **Who waits:** the user never waits for n8n. The Server Action checks session/permissions and
   input (`server-auth-actions`), saves the record (e.g. status `queued`), returns only
   `{ status, id }`, and runs the trigger with retries in `after()` (`server-after-nonblocking`).
   Anything that may approach 100 s (n8n Cloud returns 524) or whose duration is unknown is
   **async**: Respond to Webhook 202 + signed callback. → `references/response-modes.md`
6. **Callback route** `app/api/n8n/[event]/route.ts`, strictly in this order: unknown event → 404;
   content-type not JSON → 415; `raw = await req.text()`; > 64 KB → 413; `x-n8n-timestamp` off by
   > 300 s → 401; HMAC-SHA256(`N8N_CALLBACK_SECRET`, `${timestamp}.${raw}`) compared with
   `timingSafeEqual` after a length check → 401; claim `idempotency-key` → already seen: 200
   `{"duplicate":true}`; only now `JSON.parse(raw)` + shape check, body event matches the path and
   key equals `${data.jobId}:${event}` → else 400 and release the key; save the minimal state
   **before** responding (release the key if saving fails); reply 202 `{"ok":true}`; slow work in
   `after()`. → `references/callback.md`
7. **Logs:** event, direction, correlation id, status, duration, attempt, body length/sha256.
   Never bodies, names, emails, phones, IPs, tokens, signatures, secrets or full URLs with query.
   Error responses carry no internals. → `references/logging-and-limits.md`
8. Never `export const runtime = "edge"` (deprecated in Next 16; we need `node:crypto`).

Ready-to-adapt code for the client module, the action and the callback route:
`references/code-templates.md`. Known traps in docs and third-party skills: `references/pitfalls.md`.

## Checklist

```
- [ ] 1. N8N_* only on the server; .env.example: change-me-… secrets, http://127.0.0.1:5678/webhook, APP_BASE_URL.
- [ ] 2. All n8n calls go through lib/n8n/client.ts with import "server-only".
- [ ] 3. Headers x-n8n-token, idempotency-key (stored with the record), x-correlation-id; envelope version 1.
- [ ] 4. AbortSignal.timeout(10_000) per attempt; retries 1 s/3 s only for network/timeout/5xx/524.
- [ ] 5. Server Action: auth + validation inside, record saved first, trigger in after(), returns { status, id }.
- [ ] 6. Long workflow → async 202 + callback; callbackUrl = ${APP_BASE_URL}/api/n8n/<event>.
- [ ] 7. Callback route follows the 10-step order: raw text, timestamp window, timingSafeEqual, idempotency, parse last.
- [ ] 8. No personal data, bodies or secrets in logs or error responses; no runtime = "edge".
- [ ] 9. node <skill>/scripts/check-contract.mjs → 0 FAIL.
- [ ] 10. The integration has a row in docs/n8n-integrations.md (event, direction, path, mode, owner).
```

## Stop and ask a human — no exceptions — if

- the only URL you have is a **test URL** (`/webhook-test/…`) or someone asks to put one in code or
  `.env.example` — it works only 120 s after "Listen for test event";
- a token or secret would end up in client code, a `NEXT_PUBLIC_` variable, a query string, a log,
  an error message or git — or you would need to see/print a real secret value (ask the human
  to put it in `.env.local`; run scripts with `node --env-file=.env.local …`);
- the design makes the user (or a Server Action) **wait synchronously** for a workflow that can
  take longer than a few seconds or whose duration is unknown;
- the callback cannot be verified (no `N8N_CALLBACK_SECRET`, the client refuses signing, n8n would
  send the body in a way that changes bytes after signing);
- the workflow needs the full record, personal data beyond what it uses, or files instead of links;
- you are asked to create, change, export or import the workflow itself or to write n8n Code-node
  code — hand over settings as text instead (`references/n8n-setup.md`);
- you would need `runtime = "edge"`, a new npm dependency, or to change the envelope in a
  breaking way (renaming/removing fields needs a new `version`).

## Verify — done only when

- [ ] `npm run lint` and `npm run build` pass.
- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` → 0 FAIL
      (in a copy: `--root <dir> --changed-since <ref>` to see only new code).
- [ ] If the full-project run still shows FAILs in code you did not touch (older n8n calls,
      `.env.example`), list them to the human with file:line and propose migrating them onto
      `lib/n8n/client.ts` as a separate step — do not silently leave them and do not widen the task.
- [ ] With the mock (`node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000`):
      the mock log shows `POST /webhook/<event> -> 202`, `auth=ok`, `idempotency=new`; the form
      answers in well under a second; the callback line ends with `-> 202`.
- [ ] `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/<event>`
      → every case gets its expected status (bad signature 401, expired 401, replay 200 duplicate, …).
- [ ] The server log for the whole scenario has no names, emails, phones, bodies or secrets.

## Files of this skill

- `references/contract.md` — env variables, request, headers, envelope, timeout, retries, test vs production URL.
- `references/response-modes.md` — Immediately / Last Node / Respond to Webhook, the 100 s / 524 rule.
- `references/callback.md` — the callback route step by step and why each step exists.
- `references/logging-and-limits.md` — what to log, limits (16 MB, 1 MB, 64 KB, 100 s, 120 s).
- `references/code-templates.md` — `lib/n8n/client.ts`, the Server Action, `app/api/n8n/[event]/route.ts`, `.env.example`.
- `references/n8n-setup.md` — the n8n side as text for the client (Webhook, Remove Duplicates, Crypto, HTTP Request).
- `references/pitfalls.md` — contradictions between n8n docs, n8n's own code and third-party skills.
- `scripts/check-contract.mjs` — static contract check (C1–C14), `--root`, `--changed-since`, `--help`; exit 1 on FAIL.
- `scripts/send-signed-callback.mjs` — sends a matrix of signed/broken callbacks to a running route and compares status codes.
- `scripts/mock-n8n.mjs` — offline n8n (Webhook, Respond to Webhook, Header Auth, signed callback); `--help`.
