# Evidence: task-d/run-a3

Packed the same way as `docs/evidence/bin/pack-evidence.mjs` does. Each section is one original file; the originals (and raw `transcript.jsonl`) are in `docs/evidence/raw-evidence.tar.gz`.

## `task-d/run-a3/agent.diff`

Byte-identical to [`docs/ab/a-without-skill-run3.diff`](../../../ab/a-without-skill-run3.diff).

## `task-d/run-a3/check-contract-changed.txt`

```text
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/leaddesk-ab/leaddesk-ab-a3 --changed-since base; echo "exit=$?"
check-contract · root /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a3 · changed since base: 11 file(s), 532 changed line(s) + new files
n8n callers: app/actions.ts, lib/quotes.ts · callback routes: app/api/quotes/[id]/callback/route.ts
C1   PASS no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS no NEXT_PUBLIC_ variable for n8n / webhook / callback settings
C3   FAIL requests to n8n only from lib/n8n/client.ts
       lib/quotes.ts:46  fetch to n8n outside lib/n8n/client.ts
C4   FAIL the module that calls n8n starts with import "server-only"
       lib/quotes.ts:1  first statement is not import "server-only"
C5   PASS every fetch to n8n has signal: AbortSignal.timeout(...)
C6   FAIL requests to n8n send x-n8n-token, idempotency-key, x-correlation-id
       lib/quotes.ts:46  missing header(s): x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL request body is the envelope { version: 1, event, data }
       lib/quotes.ts:46  body is not the { version: 1, event, data } envelope
C8   PASS a Server Action that triggers n8n does it inside after()
C9   FAIL callback route reads the raw body; no request.json(), no JSON.parse before the signature check
       app/api/quotes/[id]/callback/route.ts:28  JSON.parse before the signature check
C10  FAIL callback signature: HMAC + length check + timingSafeEqual, never ===
       app/api/quotes/[id]/callback/route.ts:1  no HMAC computed in the route file
       app/api/quotes/[id]/callback/route.ts:1  no timingSafeEqual in the route file (helpers it imports are not followed)
C11  FAIL callback timestamp checked against a 300 s window
       app/api/quotes/[id]/callback/route.ts:1  x-n8n-timestamp is not read
C12  FAIL callback idempotency-key read and bound to data.jobId of the signed body
       app/api/quotes/[id]/callback/route.ts:1  idempotency-key is not read
C13  PASS no export const runtime = "edge"
C14  PASS no bodies, form data, personal data, tokens or signatures in console.* of n8n code
C15  FAIL .env.example: N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL
       .env.example:1  N8N_WEBHOOK_BASE_URL is missing
       .env.example:1  N8N_WEBHOOK_TOKEN is missing
       .env.example:1  N8N_CALLBACK_SECRET is missing
       .env.example:1  APP_BASE_URL is missing
Summary: 6 PASS, 9 FAIL, 0 N/A
exit=1
```

## `task-d/run-a3/diffstat.txt`

```text
 .env.example                          |   7 +++
 app/api/quotes/[id]/callback/route.ts |  47 ++++++++++++++++
 app/quotes/[id]/page.tsx              | 101 ++++++++++++++++++++++++++++++++++
 app/quotes/actions.ts                 |  34 ++++++++++++
 app/quotes/new/page.tsx               |  33 +++++++++++
 components/auto-refresh.tsx           |  17 ++++++
 components/quote-form.tsx             |  63 +++++++++++++++++++++
 lib/db.ts                             |  49 ++++++++++++++++-
 lib/quote-form.ts                     |  58 +++++++++++++++++++
 lib/quotes.ts                         |  95 ++++++++++++++++++++++++++++++++
 lib/types.ts                          |  29 ++++++++++
 11 files changed, 532 insertions(+), 1 deletion(-)
```

## `task-d/run-a3/meta.txt`

```text
claude: 2.1.282 (Claude Code)
model: opus · effort: high · cwd: /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a3
prompt sha256: 498a125e1d02c54620123dc6d3f92b176c340a7d25b879c0f2e194ef4552c39c
flags: --setting-sources project --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --allowedTools Skill,Read,Grep,Glob,Edit,Write,Bash(npm run lint),Bash(npm run build),Bash(npx tsc --noEmit),Bash(git status*),Bash(git diff*),Bash(node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs*),Bash(npm run lint *),Bash(npm run build *),Bash(npx tsc *) --disallowedTools WebFetch,WebSearch,NotebookEdit,Read(//Users/hryhorii_haponiuk/Desktop/**),Read(~/.claude/**),Read(//private/tmp/**),Read(//tmp/**),Read(//private/var/folders/**)
started: 2026-09-27T16:17:26Z
exit: 0 · wall: 291s
```

## `task-d/run-a3/report.txt`

```text
model: claude-opus-5-5
cwd: /Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a3
skills offered (init.skills): deep-research, design, slides, design-sync, dataviz, artifact-diagramming, artifact-capabilities, update-config, verify, debug, code-review, simplify, batch, fewer-permission-prompts, doctor, loop, schedule, claude-api, workflow-authoring, run, run-skill-generator
tools offered: Task, Artifact, ArtifactComments, ArtifactData, Bash, CronCreate, CronDelete, CronList, DesignSync, Edit, EnterWorktree, ExitWorktree, Glob, Grep, ListAgents, Monitor, PushNotification, Read, RemoteTrigger, ReportFindings, ScheduleWakeup, SendFeedback, SendMessage, ShareOnboardingGuide, Skill, TaskStop, ToolSearch, Workflow, Write
Skill tool calls: none
reads under .claude/skills/: none
files read (28): .claude/skills, /dev/null, app/actions.ts, app/api/leads/route.ts, lib/db.ts, lib/types.ts, lib/lead-form.ts, components/lead-form.tsx, lib/session.ts, proxy.ts, app/page.tsx, skills-lock.json, package.json, lib/audit.ts, app/dashboard/leads, ]/page.tsx, components/status-badge.tsx, .env.example, lib/data.ts, app/dashboard/leads/[id]/page.tsx, ./node_modules/next/dist/docs, ./node_modules/next/dist/docs/01-app, 03-api-reference/04-functions, 03-api-reference/03-file-conventions, node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md, node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md, next.config.ts, .gitignore
paths outside work dir (excl. node_modules): /dev/null
bash commands touching ../ ~/ /Users/: none
tool calls: Bash×8, Read×19, Glob×4, Edit×13, Write×10
denied tool calls: Bash, Bash, Bash, Write, Write
turns: 55 · duration: 290s · cost: $1.70
```

## `task-d/run-a3/scenario-signed-callback/build.log`

```text

> 2026-quitcode-04-agent-skills-hw@0.1.0 build
> next build

▲ Next.js 16.3.5 (Turbopack)
- Environments: .env.local
⚠ Warning: Next.js ignored package-lock.json in /Users/hryhorii_haponiuk because it is outside the current Git repository (/Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a3).
 To use this directory, set `turbopack.root` in your Next.js config.

✓ Running next.config.ts took 76ms

  Creating an optimized production build ...
✓ Compiled successfully in 399ms
  Running TypeScript ...
  Finished TypeScript in 762ms ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/8) ...
  Generating static pages using 9 workers (2/8) 
db:listUsers: 1
  Generating static pages using 9 workers (4/8) 
  Generating static pages using 9 workers (6/8) 
✓ Generating static pages using 9 workers (8/8) in 146ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/leads
├ ƒ /api/quotes/[id]/callback
├ ƒ /dashboard
├ ƒ /dashboard/leads/[id]
├ ○ /login
├ ƒ /quotes/[id]
└ ○ /quotes/new


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

```

## `task-d/run-a3/scenario-signed-callback/mock.log`

```text
[mock-n8n] 2026-09-27T16:25:19.290Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
[mock-n8n] 2026-09-27T16:25:19.290Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
[mock-n8n] 2026-09-27T16:25:19.290Z test URLs: not registered (start with --listen to open them for 120 s)
[mock-n8n] 2026-09-27T16:25:19.290Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
[mock-n8n] 2026-09-27T16:25:19.290Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
[mock-n8n] 2026-09-27T16:25:19.703Z POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 427 B sha256=506e69de6a73edc6f02f75e943aceff810432fb4ee773e68982e69d5a4bbf800
[mock-n8n] 2026-09-27T16:25:43.461Z stopping (SIGTERM)
```

## `task-d/run-a3/scenario-signed-callback/scenario.txt`

```text
# scenario · copy leaddesk-ab-a3 dc4b6cd+worktree · build UjpoAEWyO3AwHQzjycnMM · server pid 15157 · 2026-09-27T16:25:19Z
mock: tools/mock-n8n.mjs --mode respond-202 --delay 5000 (from the working repo, --env-file=.env.local of the copy)
.env.local keys (names only): N8N_WEBHOOK_URL N8N_QUOTE_WEBHOOK_URL APP_URL N8N_WEBHOOK_TOKEN N8N_CALLBACK_SECRET 
GET /quotes/new -> 200
form fields posted: $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY company email description budget
no-JS POST /quotes/new -> HTTP 303 in 0.136151 s (TTFB 0.135449 s)
redirect / status page: /quotes/q_051ab720-210c-4362-861d-bcc510729b1f
mock log right after the POST:
  | [mock-n8n] 2026-09-27T16:25:19.290Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T16:25:19.290Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T16:25:19.290Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T16:25:19.290Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T16:25:19.290Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T16:25:19.703Z POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 427 B sha256=506e69de6a73edc6f02f75e943aceff810432fb4ee773e68982e69d5a4bbf800
/quotes/<id> before the callback:  LeadDesk Studio Nova Кошторис для Scenario Test LLC Не вдалося підготувати кошторис автоматично Спробуйте ще раз трохи згодом. Надіслати новий запит Бюджет понад $10 000 Надіслано 27 вер. 2026 р., 19
mock log after the workflow (--mode respond-202 --delay 5000), 23 s after the POST:
  | [mock-n8n] 2026-09-27T16:25:19.290Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T16:25:19.290Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T16:25:19.290Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T16:25:19.290Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T16:25:19.290Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T16:25:19.703Z POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 427 B sha256=506e69de6a73edc6f02f75e943aceff810432fb4ee773e68982e69d5a4bbf800
/quotes/<id> after the callback:  LeadDesk Studio Nova Кошторис для Scenario Test LLC Не вдалося підготувати кошторис автоматично Спробуйте ще раз трохи згодом. Надіслати новий запит Бюджет понад $10 000 Надіслано 27 вер. 2026 р., 19
callback matrix (send-signed-callback.mjs --url http://127.0.0.1:3000/api/quotes/q_051ab720-210c-4362-861d-bcc510729b1f/callback, secret via --env-file):
  | send-signed-callback · http://127.0.0.1:3000/api/quotes/q_051ab720-210c-4362-861d-bcc510729b1f/callback · event quote-request · with success cases
  | ok   unknown event in the path                expected 404, got 404
  | FAIL wrong content-type (text/plain)          expected 415, got 401
  | FAIL body larger than 64 KB                   expected 413, got 401
  | ok   timestamp 301 s in the past              expected 401, got 401
  | ok   timestamp 301 s in the future            expected 401, got 401
  | ok   wrong signature                          expected 401, got 401
  | ok   body reformatted after signing           expected 401, got 401
  | FAIL valid signed callback                    expected 202, got 401
  | FAIL the same callback again                  expected 200, got 401 (no {"duplicate": true})
  | FAIL same signed bytes, new idempotency-key   expected 400, got 401
  | 5/10 as expected
server log: 23 lines; lines with the submitted email / company / description: 0
server log lines mentioning n8n / quote / callback:
  | db:insertQuote: 1
  | Quote q_051ab720-210c-4362-861d-bcc510729b1f: n8n answered 403
  | db:finishQuote: 1
  | db:getQuote: 1
  | db:getQuote: 2
  | db:getQuote: 3
  | db:getQuote: 4
  | db:getQuote: 5
  | db:getQuote: 6
  | db:getQuote: 7
  | db:getQuote: 8
  | db:getQuote: 9
  | db:getQuote: 10
  | db:getQuote: 11
```

## `task-d/run-a3/scenario-signed-callback/server.log`

```text
▲ Next.js 16.3.5
- Local:         http://localhost:3000
- Network:       http://192.168.0.102:3000
✓ Ready in 56ms
⚠ Warning: Next.js ignored package-lock.json in /Users/hryhorii_haponiuk because it is outside the current Git repository (/Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a3).
 To use this directory, set `outputFileTracingRoot` in your Next.js config.

✓ Running next.config.ts took 12ms
⚠ Missing `origin` header from a forwarded Server Actions request.
db:insertQuote: 1
Quote q_051ab720-210c-4362-861d-bcc510729b1f: n8n answered 403
db:finishQuote: 1
db:getQuote: 1
db:getQuote: 2
db:getQuote: 3
db:getQuote: 4
db:getQuote: 5
db:getQuote: 6
db:getQuote: 7
db:getQuote: 8
db:getQuote: 9
db:getQuote: 10
db:getQuote: 11
```

## `task-d/run-a3/scenario/build.log`

```text

> 2026-quitcode-04-agent-skills-hw@0.1.0 build
> next build

▲ Next.js 16.3.5 (Turbopack)
- Environments: .env.local
⚠ Warning: Next.js ignored package-lock.json in /Users/hryhorii_haponiuk because it is outside the current Git repository (/Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a3).
 To use this directory, set `turbopack.root` in your Next.js config.

✓ Running next.config.ts took 74ms

  Creating an optimized production build ...
✓ Compiled successfully in 653ms
  Running TypeScript ...
  Finished TypeScript in 794ms ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/8) ...
  Generating static pages using 9 workers (2/8) 
db:listUsers: 1
  Generating static pages using 9 workers (4/8) 
  Generating static pages using 9 workers (6/8) 
✓ Generating static pages using 9 workers (8/8) in 142ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/leads
├ ƒ /api/quotes/[id]/callback
├ ƒ /dashboard
├ ƒ /dashboard/leads/[id]
├ ○ /login
├ ƒ /quotes/[id]
└ ○ /quotes/new


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

```

## `task-d/run-a3/scenario/mock.log`

```text
[mock-n8n] 2026-09-27T16:23:59.620Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
[mock-n8n] 2026-09-27T16:23:59.621Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
[mock-n8n] 2026-09-27T16:23:59.621Z test URLs: not registered (start with --listen to open them for 120 s)
[mock-n8n] 2026-09-27T16:23:59.621Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
[mock-n8n] 2026-09-27T16:23:59.621Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
[mock-n8n] 2026-09-27T16:24:00.047Z POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 427 B sha256=abc731cd933391929b790eb9ba025201ad1cbb9d73d16469482c12915e6338e4
[mock-n8n] 2026-09-27T16:24:23.574Z stopping (SIGTERM)
```

## `task-d/run-a3/scenario/scenario.txt`

```text
# scenario · copy leaddesk-ab-a3 dc4b6cd+worktree · build W6pRe9WwEepAOiNFumpl3 · server pid 14758 · 2026-09-27T16:23:59Z
mock: tools/mock-n8n.mjs --mode respond-202 --delay 5000 (from the working repo, --env-file=.env.local of the copy)
.env.local keys (names only): N8N_WEBHOOK_URL N8N_QUOTE_WEBHOOK_URL APP_URL N8N_WEBHOOK_TOKEN N8N_CALLBACK_SECRET 
GET /quotes/new -> 200
form fields posted: $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY company email description budget
no-JS POST /quotes/new -> HTTP 303 in 0.136843 s (TTFB 0.136706 s)
redirect / status page: /quotes/q_f8b75b00-a017-48b2-b8c6-ee2eddfcfbfa
mock log right after the POST:
  | [mock-n8n] 2026-09-27T16:23:59.620Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T16:23:59.621Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T16:23:59.621Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T16:23:59.621Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T16:23:59.621Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T16:24:00.047Z POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 427 B sha256=abc731cd933391929b790eb9ba025201ad1cbb9d73d16469482c12915e6338e4
/quotes/<id> before the callback:  LeadDesk Studio Nova Кошторис для Scenario Test LLC Не вдалося підготувати кошторис автоматично Спробуйте ще раз трохи згодом. Надіслати новий запит Бюджет понад $10 000 Надіслано 27 вер. 2026 р., 19
mock log after the workflow (--mode respond-202 --delay 5000), 23 s after the POST:
  | [mock-n8n] 2026-09-27T16:23:59.620Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T16:23:59.621Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T16:23:59.621Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T16:23:59.621Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T16:23:59.621Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T16:24:00.047Z POST /webhook/quote-request -> 403 in 1 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 427 B sha256=abc731cd933391929b790eb9ba025201ad1cbb9d73d16469482c12915e6338e4
/quotes/<id> after the callback:  LeadDesk Studio Nova Кошторис для Scenario Test LLC Не вдалося підготувати кошторис автоматично Спробуйте ще раз трохи згодом. Надіслати новий запит Бюджет понад $10 000 Надіслано 27 вер. 2026 р., 19
callback matrix (send-signed-callback.mjs --url http://127.0.0.1:3000/api/quotes/q_f8b75b00-a017-48b2-b8c6-ee2eddfcfbfa/callback, secret via --env-file):
  | send-signed-callback · http://127.0.0.1:3000/api/quotes/q_f8b75b00-a017-48b2-b8c6-ee2eddfcfbfa/callback · event quote-request · success cases skipped (no --request-key)
  | ok   unknown event in the path                expected 404, got 404
  | FAIL wrong content-type (text/plain)          expected 415, got 401
  | FAIL body larger than 64 KB                   expected 413, got 401
  | ok   timestamp 301 s in the past              expected 401, got 401
  | ok   timestamp 301 s in the future            expected 401, got 401
  | ok   wrong signature                          expected 401, got 401
  | ok   body reformatted after signing           expected 401, got 401
  | 5/7 as expected
server log: 20 lines; lines with the submitted email / company / description: 0
server log lines mentioning n8n / quote / callback:
  | db:insertQuote: 1
  | Quote q_f8b75b00-a017-48b2-b8c6-ee2eddfcfbfa: n8n answered 403
  | db:finishQuote: 1
  | db:getQuote: 1
  | db:getQuote: 2
  | db:getQuote: 3
  | db:getQuote: 4
  | db:getQuote: 5
  | db:getQuote: 6
  | db:getQuote: 7
  | db:getQuote: 8
```

## `task-d/run-a3/scenario/server.log`

```text
▲ Next.js 16.3.5
- Local:         http://localhost:3000
- Network:       http://192.168.0.102:3000
✓ Ready in 61ms
⚠ Warning: Next.js ignored package-lock.json in /Users/hryhorii_haponiuk because it is outside the current Git repository (/Users/hryhorii_haponiuk/leaddesk-ab/leaddesk-ab-a3).
 To use this directory, set `outputFileTracingRoot` in your Next.js config.

✓ Running next.config.ts took 13ms
⚠ Missing `origin` header from a forwarded Server Actions request.
db:insertQuote: 1
Quote q_f8b75b00-a017-48b2-b8c6-ee2eddfcfbfa: n8n answered 403
db:finishQuote: 1
db:getQuote: 1
db:getQuote: 2
db:getQuote: 3
db:getQuote: 4
db:getQuote: 5
db:getQuote: 6
db:getQuote: 7
db:getQuote: 8
```

## `task-d/run-a3/stderr.txt`

_(empty file)_

## `task-d/run-a3/transcript.jsonl`

Raw stream-json transcript, only in `raw-evidence.tar.gz`. Readable form: `transcript.md` of this unit.
