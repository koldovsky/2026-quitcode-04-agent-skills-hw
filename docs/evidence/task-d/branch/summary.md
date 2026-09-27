# Evidence: task-d/branch

Packed by `docs/evidence/bin/pack-evidence.mjs`. Each section is one original file; the originals (and raw `transcript.jsonl`) are in `docs/evidence/raw-evidence.tar.gz`.

## `task-d/branch/check-contract-final.txt`

```text
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs; echo "exit=$?"   # увесь проєкт
check-contract · root <repo> · full
n8n callers: lib/n8n/client.ts · callback routes: app/api/n8n/[event]/route.ts
C1   PASS no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS no NEXT_PUBLIC_ variable for n8n / webhook / callback settings
C3   PASS requests to n8n only from lib/n8n/client.ts
C4   PASS the module that calls n8n starts with import "server-only"
C5   PASS every fetch to n8n has signal: AbortSignal.timeout(...)
C6   PASS requests to n8n send x-n8n-token, idempotency-key, x-correlation-id
C7   PASS request body is the envelope { version: 1, event, data }
C8   PASS a Server Action that triggers n8n does it inside after()
C9   PASS callback route reads the raw body; no request.json(), no JSON.parse before the signature check
C10  PASS callback signature: HMAC + length check + timingSafeEqual, never ===
C11  PASS callback timestamp checked against a 300 s window
C12  PASS callback idempotency-key read and bound to data.jobId of the signed body
C13  PASS no export const runtime = "edge"
C14  PASS no bodies, form data, personal data, tokens or signatures in console.* of n8n code
C15  PASS .env.example: N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL
Summary: 15 PASS, 0 FAIL, 0 N/A
exit=0
```

## `task-d/branch/lead-check.txt`

```text
# lead-created check · 9ab228f · build lJIOIyp0ArAwPlUVguy23 · pid 61528 · 2026-09-27T14:21:20Z
no-JS POST / (lead form) -> HTTP 200 in 0.433904 s
mock log (mode immediately):
  | [mock-n8n] 2026-09-27T14:21:20.988Z POST /webhook/lead-created -> 200 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 266 B 
server log n8n lines:
  | {"n8n":"out","event":"lead-created","correlationId":"4dbd2ecf-ecc9-4b95-81ee-8c94fd9c0719","attempt":1,"status":200,"ms":8}
server log lines with the submitted email / phone / message: 0
```

## `task-d/branch/scenario/build.log`

```text

> 2026-quitcode-04-agent-skills-hw@0.1.0 build
> next build

▲ Next.js 16.3.5 (Turbopack)
- Environments: .env.local
⚠ Warning: Next.js ignored package-lock.json in /Users/hryhorii_haponiuk because it is outside the current Git repository (/Users/hryhorii_haponiuk/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw).
 To use this directory, set `turbopack.root` in your Next.js config.

✓ Running next.config.ts took 10ms

  Creating an optimized production build ...
✓ Compiled successfully in 267ms
  Running TypeScript ...
  Finished TypeScript in 692ms ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/8) ...
  Generating static pages using 9 workers (2/8) 
db:listUsers: 1
  Generating static pages using 9 workers (4/8) 
  Generating static pages using 9 workers (6/8) 
✓ Generating static pages using 9 workers (8/8) in 127ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/leads
├ ƒ /api/n8n/[event]
├ ƒ /dashboard
├ ƒ /dashboard/leads/[id]
├ ○ /login
├ ƒ /quotes/[id]
└ ○ /quotes/new


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

```

## `task-d/branch/scenario/mock.log`

```text
[mock-n8n] 2026-09-27T14:20:53.153Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
[mock-n8n] 2026-09-27T14:20:53.154Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
[mock-n8n] 2026-09-27T14:20:53.154Z test URLs: not registered (start with --listen to open them for 120 s)
[mock-n8n] 2026-09-27T14:20:53.154Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
[mock-n8n] 2026-09-27T14:20:53.154Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
[mock-n8n] 2026-09-27T14:20:53.587Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=5dd53f058f245df063b6a5eb1166b2a2770c77fa933d529784ae94c763604564
[mock-n8n] 2026-09-27T14:20:53.587Z workflow 4093ad01-4fa7-45d1-8e46-57a852277ada running for 5000 ms, then callback event=quote-request.completed
[mock-n8n] 2026-09-27T14:20:58.813Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 223 ms (try 1/3) event=quote-request.completed body 382 B sha256=712bfb28cb144578e4a337e9c749ea3b534172d59657a350b78052e5854e5a1c
[mock-n8n] 2026-09-27T14:21:00.109Z stopping (SIGTERM)
```

## `task-d/branch/scenario/scenario.txt`

```text
# scenario · copy 2026-quitcode-04-agent-skills-hw 9ab228f · build lJIOIyp0ArAwPlUVguy23 · server pid 61419 · 2026-09-27T14:20:53Z
mock: tools/mock-n8n.mjs --mode respond-202 --delay 5000 (from the working repo, --env-file=.env.local of the copy)
.env.local keys (names only): N8N_WEBHOOK_BASE_URL N8N_WEBHOOK_TOKEN N8N_CALLBACK_SECRET APP_BASE_URL 
GET /quotes/new -> 200
form fields posted: $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY company email description budget
no-JS POST /quotes/new -> HTTP 303 in 0.135481 s (TTFB 0.135281 s)
redirect / status page: /quotes/da55c4b7-2871-4f0f-8a82-739b5e387027
mock log right after the POST:
  | [mock-n8n] 2026-09-27T14:20:53.153Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T14:20:53.154Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T14:20:53.154Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T14:20:53.154Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T14:20:53.154Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T14:20:53.587Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=5dd53f058f245df063b6a5eb1166b2a2770c77fa933d529784ae94c763604564
  | [mock-n8n] 2026-09-27T14:20:53.587Z workflow 4093ad01-4fa7-45d1-8e46-57a852277ada running for 5000 ms, then callback event=quote-request.completed
/quotes/<id> before the callback:  LeadDesk ← Studio Nova Кошторис для Scenario Test LLC Запит від 27 вер. 2026 р., 17:20 Готуємо кошторис Зазвичай це займає одну-дві хвилини. Сторінка оновиться сама. 
mock log after the workflow (--mode respond-202 --delay 5000), 6 s after the POST:
  | [mock-n8n] 2026-09-27T14:20:53.153Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T14:20:53.154Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T14:20:53.154Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T14:20:53.154Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T14:20:53.154Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T14:20:53.587Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=5dd53f058f245df063b6a5eb1166b2a2770c77fa933d529784ae94c763604564
  | [mock-n8n] 2026-09-27T14:20:53.587Z workflow 4093ad01-4fa7-45d1-8e46-57a852277ada running for 5000 ms, then callback event=quote-request.completed
  | [mock-n8n] 2026-09-27T14:20:58.813Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 223 ms (try 1/3) event=quote-request.completed body 382 B sha256=712bfb28cb144578e4a337e9c749ea3b534172d59657a350b78052e5854e5a1c
/quotes/<id> after the callback:  LeadDesk ← Studio Nova Кошторис для Scenario Test LLC Запит від 27 вер. 2026 р., 17:20 Кошторис готовий Завантажте PDF за посиланням нижче. Завантажити PDF 
callback matrix (send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request, secret via --env-file):
  | send-signed-callback · http://127.0.0.1:3000/api/n8n/quote-request · event quote-request · success cases skipped (no --request-key)
  | ok   unknown event in the path                expected 404, got 404
  | ok   wrong content-type (text/plain)          expected 415, got 415
  | ok   body larger than 64 KB                   expected 413, got 413
  | ok   timestamp 301 s in the past              expected 401, got 401
  | ok   timestamp 301 s in the future            expected 401, got 401
  | ok   wrong signature                          expected 401, got 401
  | ok   body reformatted after signing           expected 401, got 401
  | 7/7 as expected
server log: 26 lines; lines with the submitted email / company / description: 0
server log lines mentioning n8n / quote / callback:
  | db:insertQuote: 1
  | {"n8n":"out","event":"quote-request","correlationId":"5dafdf7f-9311-4783-b1b3-12728e25eed1","attempt":1,"status":202,"ms":12}
  | db:getQuote: 1
  | db:updateQuote: 1
  | db:getQuote: 2
  | db:claimCallbackKey: 1
  | db:getQuoteByRequestKey: 1
  | db:updateQuote: 2
  | {"n8n":"in","event":"quote-request","correlationId":"5dafdf7f-9311-4783-b1b3-12728e25eed1","status":202,"bytes":382,"ms":185}
  | db:getQuote: 3
  | {"n8n":"in","event":"no-such-event-xyz","correlationId":"115bad50-0e74-445d-a8ab-4dc2485a5d67","status":404,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"66ade1f0-23f1-4847-a94b-85e3e022aeaf","status":415,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"538b1999-018a-4985-91ab-e4d87f6b906b","status":413,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"5c4f8194-7da1-47f9-aa92-324445d167b4","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"a4405bf9-667e-40cc-9ca3-0c034365585e","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"a73dc898-f94b-46fb-91f6-a14eb41dced5","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"d4f7f018-2652-4db3-a2e7-78b2b8d3719c","status":401,"bytes":447,"ms":1}
```

## `task-d/branch/scenario/server.log`

```text
▲ Next.js 16.3.5
- Local:         http://localhost:3000
- Network:       http://192.168.0.102:3000
✓ Ready in 57ms
⚠ Warning: Next.js ignored package-lock.json in /Users/hryhorii_haponiuk because it is outside the current Git repository (/Users/hryhorii_haponiuk/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw).
 To use this directory, set `outputFileTracingRoot` in your Next.js config.

✓ Running next.config.ts took 13ms
⚠ Missing `origin` header from a forwarded Server Actions request.
db:insertQuote: 1
{"n8n":"out","event":"quote-request","correlationId":"5dafdf7f-9311-4783-b1b3-12728e25eed1","attempt":1,"status":202,"ms":12}
db:getQuote: 1
db:updateQuote: 1
db:getQuote: 2
db:claimCallbackKey: 1
db:getQuoteByRequestKey: 1
db:updateQuote: 2
{"n8n":"in","event":"quote-request","correlationId":"5dafdf7f-9311-4783-b1b3-12728e25eed1","status":202,"bytes":382,"ms":185}
db:getQuote: 3
{"n8n":"in","event":"no-such-event-xyz","correlationId":"115bad50-0e74-445d-a8ab-4dc2485a5d67","status":404,"bytes":0,"ms":0}
{"n8n":"in","event":"quote-request","correlationId":"66ade1f0-23f1-4847-a94b-85e3e022aeaf","status":415,"bytes":0,"ms":0}
{"n8n":"in","event":"quote-request","correlationId":"538b1999-018a-4985-91ab-e4d87f6b906b","status":413,"bytes":0,"ms":0}
{"n8n":"in","event":"quote-request","correlationId":"5c4f8194-7da1-47f9-aa92-324445d167b4","status":401,"bytes":382,"ms":0}
{"n8n":"in","event":"quote-request","correlationId":"a4405bf9-667e-40cc-9ca3-0c034365585e","status":401,"bytes":382,"ms":0}
{"n8n":"in","event":"quote-request","correlationId":"a73dc898-f94b-46fb-91f6-a14eb41dced5","status":401,"bytes":382,"ms":0}
{"n8n":"in","event":"quote-request","correlationId":"d4f7f018-2652-4db3-a2e7-78b2b8d3719c","status":401,"bytes":447,"ms":1}
```

## `task-d/branch/scenario-after-review.txt`

Сценарій на гілці після виправлень за рев'ю CodeRabbit (quote-form a11y, ліміт автооновлення):

```text
# scenario · copy 2026-quitcode-04-agent-skills-hw 0b0cea4+worktree · build FeoYKt9oGweEMXbA6LjJH · server pid 83306 · 2026-09-27T15:19:13Z
mock: tools/mock-n8n.mjs --mode respond-202 --delay 5000 (from the working repo, --env-file=.env.local of the copy)
.env.local keys (names only): N8N_WEBHOOK_BASE_URL N8N_WEBHOOK_TOKEN N8N_CALLBACK_SECRET APP_BASE_URL 
GET /quotes/new -> 200
form fields posted: $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY company email description budget
no-JS POST /quotes/new -> HTTP 303 in 0.135712 s (TTFB 0.135484 s)
redirect / status page: /quotes/8bf28054-714e-4a98-b187-6e770a4202ee
mock log right after the POST:
  | [mock-n8n] 2026-09-27T15:19:13.010Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T15:19:13.011Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T15:19:13.011Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T15:19:13.011Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T15:19:13.011Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T15:19:13.439Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=92199aa58d0b7e9fc561864db5be71a2e549b8ff0aae6169ae71383e9acdd38d
  | [mock-n8n] 2026-09-27T15:19:13.439Z workflow 69cd78b5-29c2-4728-beb7-0f976d70e7b2 running for 5000 ms, then callback event=quote-request.completed
/quotes/<id> before the callback:  LeadDesk ← Studio Nova Кошторис для Scenario Test LLC Запит від 27 вер. 2026 р., 18:19 Готуємо кошторис Зазвичай це займає одну-дві хвилини. Сторінка оновиться сама. 
mock log after the workflow (--mode respond-202 --delay 5000), 6 s after the POST:
  | [mock-n8n] 2026-09-27T15:19:13.010Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T15:19:13.011Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T15:19:13.011Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T15:19:13.011Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T15:19:13.011Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T15:19:13.439Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=92199aa58d0b7e9fc561864db5be71a2e549b8ff0aae6169ae71383e9acdd38d
  | [mock-n8n] 2026-09-27T15:19:13.439Z workflow 69cd78b5-29c2-4728-beb7-0f976d70e7b2 running for 5000 ms, then callback event=quote-request.completed
  | [mock-n8n] 2026-09-27T15:19:18.662Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 221 ms (try 1/3) event=quote-request.completed body 382 B sha256=29da45ecba4debeb8254342749aadd2f14ac17985096657978744dd7dbef20ad
/quotes/<id> after the callback:  LeadDesk ← Studio Nova Кошторис для Scenario Test LLC Запит від 27 вер. 2026 р., 18:19 Кошторис готовий Завантажте PDF за посиланням нижче. Завантажити PDF 
callback matrix (send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request, secret via --env-file):
  | send-signed-callback · http://127.0.0.1:3000/api/n8n/quote-request · event quote-request · success cases skipped (no --request-key)
  | ok   unknown event in the path                expected 404, got 404
  | ok   wrong content-type (text/plain)          expected 415, got 415
  | ok   body larger than 64 KB                   expected 413, got 413
  | ok   timestamp 301 s in the past              expected 401, got 401
  | ok   timestamp 301 s in the future            expected 401, got 401
  | ok   wrong signature                          expected 401, got 401
  | ok   body reformatted after signing           expected 401, got 401
  | 7/7 as expected
server log: 26 lines; lines with the submitted email / company / description: 0
server log lines mentioning n8n / quote / callback:
  | db:insertQuote: 1
  | {"n8n":"out","event":"quote-request","correlationId":"daebf517-edba-44cb-9152-c12b4ff1800e","attempt":1,"status":202,"ms":12}
  | db:getQuote: 1
  | db:updateQuote: 1
  | db:getQuote: 2
  | db:claimCallbackKey: 1
  | db:getQuoteByRequestKey: 1
  | db:updateQuote: 2
  | {"n8n":"in","event":"quote-request","correlationId":"daebf517-edba-44cb-9152-c12b4ff1800e","status":202,"bytes":382,"ms":186}
  | db:getQuote: 3
  | {"n8n":"in","event":"no-such-event-xyz","correlationId":"9d7cb739-c349-42e7-b298-6172a4ee0b62","status":404,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"a56b950b-f1da-4ba5-a4e0-7d8f32440c27","status":415,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"ca19ae72-6530-403b-9234-3237f78349d6","status":413,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"80c1cab5-06f9-43bd-b132-bce710ec0a8f","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"54acfeb0-3ba5-48a0-8a55-38c4b3484a43","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"578659ee-aa27-4084-84a3-46232ba8164b","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"0f8a851b-d43d-419d-a437-a716d8d22e0b","status":401,"bytes":447,"ms":0}
```

## `task-d/branch/quote-form-a11y.txt`

Порожня / невалідна відправка /quotes/new без JS після виправлення доступності помилок:

```text
empty no-JS POST -> HTTP 200
aria-invalid="true": 4
aria-describedby: aria-describedby="quote-budget-error" aria-describedby="quote-company-error" aria-describedby="quote-description-error" aria-describedby="quote-email-error" 
error ids: id="quote-budget-error" id="quote-company-error" id="quote-description-error" id="quote-email-error" 
role=alert summary: Перевірте поля форми: 
label htmlFor: for="quote-budget" for="quote-company" for="quote-description" for="quote-email" 
```

## `task-d/branch/lead-created-n8n-down.txt`

Форма ліда, коли n8n недоступний: 3 спроби, потім запис аудиту lead.n8n_failed (db:insertAuditEntry: 2):

```text
# lead-created with n8n down (nothing on :5678) · 0b0cea4+worktree · build Rf9KpPlYSc1zCbpDnHMIf · pid 83197
no-JS POST / (lead form) -> HTTP 200 in 0.436812 s
server log, n8n and audit lines:
  | db:insertAuditEntry: 1
  | {"n8n":"out","event":"lead-created","correlationId":"1359fed1-028c-434f-bf6b-117c491c355d","attempt":1,"status":"TypeError","ms":4}
  | {"n8n":"out","event":"lead-created","correlationId":"1359fed1-028c-434f-bf6b-117c491c355d","attempt":2,"status":"TypeError","ms":3}
  | {"n8n":"out","event":"lead-created","correlationId":"1359fed1-028c-434f-bf6b-117c491c355d","attempt":3,"status":"TypeError","ms":2}
  | db:insertAuditEntry: 2
server log lines with the submitted email / phone / message: 0
```

## `task-d/branch/audit-before.txt`

Три дефекти з аудиту, відтворені на коді до виправлень (`12b3397`): `bash docs/evidence/task-d/audit-regress.sh`.

```text
# audit regression · 12b3397 · build X7y-Hjdm_SveEUS83Yax0 · pid 5021 · 2026-09-27T16:05:30Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
FAIL budget "1500,50" -> 1500.5 — n8n got 150050
FAIL budget "1500.50" -> 1500.5 — n8n got 1501
FAIL budget "1 500,5" -> 1500.5 — n8n got 15005
ok   budget "" -> null — n8n got null
FAIL budget "1,2,3" -> form error — accepted, n8n got 123
FAIL budget "1,500" -> form error — accepted, n8n got 1500
FAIL budget "1e3" -> form error — accepted, n8n got 1000
FAIL budget "0x10" -> form error — accepted, n8n got 16
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
# 2. signed callback: event suffix must match data.status
FAIL quote-request.completed + status "failed" -> 400 — got 202, page: Не вдалося підготувати кошторис
FAIL quote-request.failed + status "completed" -> 400 — got 202, page: Кошторис готовий
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
FAIL 21 quotes with a completed callback all end "Кошторис готовий" — 40 ms: callback 202, page "Готуємо кошторис"; 60 ms: callback 202, page "Готуємо кошторис"; 80 ms: callback 202, page "Готуємо кошторис"; 100 ms: callback 202, page "Готуємо кошторис"
result: 6 ok, 10 FAIL
```

## `task-d/branch/audit-ablation-budget.txt`

Абляція: усі три виправлення в робочому дереві, повернуто лише розбір бюджету (`lib/quote-form.ts`, `components/quote-form.tsx`).

```text
# audit regression · 12b3397+worktree · build hw3_mUXBSZMXD5SGYc8-8 · pid 5245 · 2026-09-27T16:07:12Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
FAIL budget "1500,50" -> 1500.5 — n8n got 150050
FAIL budget "1500.50" -> 1500.5 — n8n got 1501
FAIL budget "1 500,5" -> 1500.5 — n8n got 15005
ok   budget "" -> null — n8n got null
FAIL budget "1,2,3" -> form error — accepted, n8n got 123
FAIL budget "1,500" -> form error — accepted, n8n got 1500
FAIL budget "1e3" -> form error — accepted, n8n got 1000
FAIL budget "0x10" -> form error — accepted, n8n got 16
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
# 2. signed callback: event suffix must match data.status
ok   quote-request.completed + status "failed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.failed + status "completed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
ok   21 quotes with a completed callback all end "Кошторис готовий"
result: 9 ok, 7 FAIL
```

## `task-d/branch/audit-ablation-event.txt`

Абляція: повернуто лише звірку `event` ↔ `data.status` (`app/api/n8n/[event]/route.ts`).

```text
# audit regression · 12b3397+worktree · build eHQpvsrlJlg0PnSOTTGs8 · pid 5323 · 2026-09-27T16:07:28Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
ok   budget "1500,50" -> 1500.5 — n8n got 1500.5
ok   budget "1500.50" -> 1500.5 — n8n got 1500.5
ok   budget "1 500,5" -> 1500.5 — n8n got 1500.5
ok   budget "" -> null — n8n got null
ok   budget "1,2,3" -> form error — form error
ok   budget "1,500" -> form error — form error
ok   budget "1e3" -> form error — form error
ok   budget "0x10" -> form error — form error
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
# 2. signed callback: event suffix must match data.status
FAIL quote-request.completed + status "failed" -> 400 — got 202, page: Не вдалося підготувати кошторис
FAIL quote-request.failed + status "completed" -> 400 — got 202, page: Кошторис готовий
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
ok   21 quotes with a completed callback all end "Кошторис готовий"
result: 14 ok, 2 FAIL
```

## `task-d/branch/audit-ablation-race.txt`

Абляція: повернуто лише атомарний запис статусу (`lib/db.ts`, `app/quotes/actions.ts`).

```text
# audit regression · 12b3397+worktree · build pIHyTFonxuS3zFVHqfucQ · pid 5400 · 2026-09-27T16:07:44Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
ok   budget "1500,50" -> 1500.5 — n8n got 1500.5
ok   budget "1500.50" -> 1500.5 — n8n got 1500.5
ok   budget "1 500,5" -> 1500.5 — n8n got 1500.5
ok   budget "" -> null — n8n got null
ok   budget "1,2,3" -> form error — form error
ok   budget "1,500" -> form error — form error
ok   budget "1e3" -> form error — form error
ok   budget "0x10" -> form error — form error
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
# 2. signed callback: event suffix must match data.status
ok   quote-request.completed + status "failed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.failed + status "completed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
FAIL 21 quotes with a completed callback all end "Кошторис готовий" — 40 ms: callback 202, page "Готуємо кошторис"; 60 ms: callback 202, page "Готуємо кошторис"; 80 ms: callback 202, page "Готуємо кошторис"; 100 ms: callback 202, page "Готуємо кошторис"
result: 15 ok, 1 FAIL
```

## `task-d/branch/audit-after.txt`

Ті самі перевірки на закомміченому виправленому коді.

```text
# audit regression · c3545ea · build iInU1UoL3VivlAedXcNzD · pid 6290 · 2026-09-27T16:12:10Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
ok   budget "1500,50" -> 1500.5 — n8n got 1500.5
ok   budget "1500.50" -> 1500.5 — n8n got 1500.5
ok   budget "1 500,5" -> 1500.5 — n8n got 1500.5
ok   budget "" -> null — n8n got null
ok   budget "1,2,3" -> form error — form error
ok   budget "1,500" -> form error — form error
ok   budget "1e3" -> form error — form error
ok   budget "0x10" -> form error — form error
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
# 2. signed callback: event suffix must match data.status
ok   quote-request.completed + status "failed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.failed + status "completed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
ok   21 quotes with a completed callback all end "Кошторис готовий"
result: 16 ok, 0 FAIL
```

## `task-d/branch/scenario-after-audit.txt`

Повний сценарій після виправлень за аудитом: форма без JS → мок n8n → підписаний колбек → «Кошторис готовий», матриця колбека.

```text
# scenario · copy 2026-quitcode-04-agent-skills-hw c3545ea · build wUFI-IBBOdbJ3DGbUgXoI · server pid 6362 · 2026-09-27T16:12:25Z
mock: tools/mock-n8n.mjs --mode respond-202 --delay 5000 (from the working repo, --env-file=.env.local of the copy)
.env.local keys (names only): N8N_WEBHOOK_BASE_URL N8N_WEBHOOK_TOKEN N8N_CALLBACK_SECRET APP_BASE_URL 
GET /quotes/new -> 200
form fields posted: $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY company email description budget
no-JS POST /quotes/new -> HTTP 303 in 0.134884 s (TTFB 0.134717 s)
redirect / status page: /quotes/b89f7792-1c10-4bbe-9a3a-209f7bfd8fb9
mock log right after the POST:
  | [mock-n8n] 2026-09-27T16:12:24.973Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T16:12:24.974Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T16:12:24.974Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T16:12:24.974Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T16:12:24.974Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T16:12:25.402Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=30c51dc6845517d3dadc5a4181ee6347348eebb729b334313b2e5e9614c29b56
  | [mock-n8n] 2026-09-27T16:12:25.402Z workflow 0381e841-87a4-4d5a-bd78-006dbc949150 running for 5000 ms, then callback event=quote-request.completed
/quotes/<id> before the callback:  LeadDesk ← Studio Nova Кошторис для Scenario Test LLC Запит від 27 вер. 2026 р., 19:12 Готуємо кошторис Зазвичай це займає одну-дві хвилини. Сторінка оновиться сама. 
mock log after the workflow (--mode respond-202 --delay 5000), 6 s after the POST:
  | [mock-n8n] 2026-09-27T16:12:24.973Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T16:12:24.974Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T16:12:24.974Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T16:12:24.974Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T16:12:24.974Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T16:12:25.402Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=30c51dc6845517d3dadc5a4181ee6347348eebb729b334313b2e5e9614c29b56
  | [mock-n8n] 2026-09-27T16:12:25.402Z workflow 0381e841-87a4-4d5a-bd78-006dbc949150 running for 5000 ms, then callback event=quote-request.completed
  | [mock-n8n] 2026-09-27T16:12:30.627Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 223 ms (try 1/3) event=quote-request.completed body 382 B sha256=bcfb28cb61fa2e4589afc95785ed0525796067814857d5467c91a51087b949b2
/quotes/<id> after the callback:  LeadDesk ← Studio Nova Кошторис для Scenario Test LLC Запит від 27 вер. 2026 р., 19:12 Кошторис готовий Завантажте PDF за посиланням нижче. Завантажити PDF 
callback matrix (send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request, secret via --env-file):
  | send-signed-callback · http://127.0.0.1:3000/api/n8n/quote-request · event quote-request · success cases skipped (no --request-key)
  | ok   unknown event in the path                expected 404, got 404
  | ok   wrong content-type (text/plain)          expected 415, got 415
  | ok   body larger than 64 KB                   expected 413, got 413
  | ok   timestamp 301 s in the past              expected 401, got 401
  | ok   timestamp 301 s in the future            expected 401, got 401
  | ok   wrong signature                          expected 401, got 401
  | ok   body reformatted after signing           expected 401, got 401
  | 7/7 as expected
server log: 25 lines; lines with the submitted email / company / description: 0
server log lines mentioning n8n / quote / callback:
  | db:insertQuote: 1
  | {"n8n":"out","event":"quote-request","correlationId":"80977ff0-1970-4feb-9f13-0d3f4569fbe2","attempt":1,"status":202,"ms":13}
  | db:updateQuote: 1
  | db:getQuote: 1
  | db:claimCallbackKey: 1
  | db:getQuoteByRequestKey: 1
  | db:updateQuote: 2
  | {"n8n":"in","event":"quote-request","correlationId":"80977ff0-1970-4feb-9f13-0d3f4569fbe2","status":202,"bytes":382,"ms":186}
  | db:getQuote: 2
  | {"n8n":"in","event":"no-such-event-xyz","correlationId":"8d95ba0f-b613-4fae-b597-23c6eb87eb76","status":404,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"ceec3259-b252-4b10-bd36-d8a5f684eb06","status":415,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"1f33c42e-8bb5-4ec3-a48b-32970a5f44e4","status":413,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"231c2b0d-a481-4bd4-9d9c-6adca52e4d34","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"10c9012c-c4fb-4c43-a389-a68dac70f3d7","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"449369e2-c572-498e-866a-3a7717034ff6","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"bfbe91c3-a3b9-4ec1-aa19-8e2032f3415e","status":401,"bytes":447,"ms":1}
```

## `task-d/branch/check-contract-after-audit.txt`

`check-contract.mjs` на коді після виправлень за аудитом.

```text
check-contract · root /Users/hryhorii_haponiuk/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw · full
n8n callers: lib/n8n/client.ts · callback routes: app/api/n8n/[event]/route.ts
C1   PASS no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS no NEXT_PUBLIC_ variable for n8n / webhook / callback settings
C3   PASS requests to n8n only from lib/n8n/client.ts
C4   PASS the module that calls n8n starts with import "server-only"
C5   PASS every fetch to n8n has signal: AbortSignal.timeout(...)
C6   PASS requests to n8n send x-n8n-token, idempotency-key, x-correlation-id
C7   PASS request body is the envelope { version: 1, event, data }
C8   PASS a Server Action that triggers n8n does it inside after()
C9   PASS callback route reads the raw body; no request.json(), no JSON.parse before the signature check
C10  PASS callback signature: HMAC + length check + timingSafeEqual, never ===
C11  PASS callback timestamp checked against a 300 s window
C12  PASS callback idempotency-key read and bound to data.jobId of the signed body
C13  PASS no export const runtime = "edge"
C14  PASS no bodies, form data, personal data, tokens or signatures in console.* of n8n code
C15  PASS .env.example: N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL
Summary: 15 PASS, 0 FAIL, 0 N/A
```

## `task-d/branch/review-before.txt`

Код-рев'ю: `audit-regress.mjs` з двома новими кейсами (№4 — пізній failed після ready, 33-символьний бюджет) на коді до виправлень (`5b03b14`).

```text
# audit regression · 2026-quitcode-04-agent-skills-hw 5b03b14 · build gjdzLlMYu-TYm6LTINgBZ · pid 34234 · 2026-09-27T16:50:55Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
ok   budget "1500,50" -> 1500.5 — n8n got 1500.5
ok   budget "1500.50" -> 1500.5 — n8n got 1500.5
ok   budget "1 500,5" -> 1500.5 — n8n got 1500.5
ok   budget "" -> null — n8n got null
ok   budget "1,2,3" -> form error — form error
ok   budget "1,500" -> form error — form error
ok   budget "1e3" -> form error — form error
ok   budget "0x10" -> form error — form error
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
FAIL budget "5                               0" -> form error — accepted, n8n got 5
# 2. signed callback: event suffix must match data.status
ok   quote-request.completed + status "failed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.failed + status "completed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
ok   21 quotes with a completed callback all end "Кошторис готовий"
# 4. a failed callback of another n8n execution after a completed one
FAIL completed, then failed (new jobId) -> page still "Кошторис готовий" — callbacks 202, 202; page "Не вдалося підготувати кошторис"
result: 16 ok, 2 FAIL
```

## `task-d/branch/review-ablation-ready-final.txt`

Абляція: виправлення в дереві, повернуто лише `app/api/n8n/[event]/route.ts` і `lib/db.ts`.

```text
# audit regression · 2026-quitcode-04-agent-skills-hw 5b03b14+worktree · build xvBlIXRMivLVrQrGh9bCD · pid 34593 · 2026-09-27T16:52:47Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
ok   budget "1500,50" -> 1500.5 — n8n got 1500.5
ok   budget "1500.50" -> 1500.5 — n8n got 1500.5
ok   budget "1 500,5" -> 1500.5 — n8n got 1500.5
ok   budget "" -> null — n8n got null
ok   budget "1,2,3" -> form error — form error
ok   budget "1,500" -> form error — form error
ok   budget "1e3" -> form error — form error
ok   budget "0x10" -> form error — form error
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
ok   budget "5                               0" -> form error — form error
# 2. signed callback: event suffix must match data.status
ok   quote-request.completed + status "failed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.failed + status "completed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
ok   21 quotes with a completed callback all end "Кошторис готовий"
# 4. a failed callback of another n8n execution after a completed one
FAIL completed, then failed (new jobId) -> page still "Кошторис готовий" — callbacks 202, 202; page "Не вдалося підготувати кошторис"
result: 17 ok, 1 FAIL
```

## `task-d/branch/review-ablation-budget-length.txt`

Абляція: повернуто лише `lib/quote-form.ts`.

```text
# audit regression · 2026-quitcode-04-agent-skills-hw 5b03b14+worktree · build e8TbH6letzhjcJWnfjzPE · pid 34671 · 2026-09-27T16:53:03Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
ok   budget "1500,50" -> 1500.5 — n8n got 1500.5
ok   budget "1500.50" -> 1500.5 — n8n got 1500.5
ok   budget "1 500,5" -> 1500.5 — n8n got 1500.5
ok   budget "" -> null — n8n got null
ok   budget "1,2,3" -> form error — form error
ok   budget "1,500" -> form error — form error
ok   budget "1e3" -> form error — form error
ok   budget "0x10" -> form error — form error
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
FAIL budget "5                               0" -> form error — accepted, n8n got 5
# 2. signed callback: event suffix must match data.status
ok   quote-request.completed + status "failed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.failed + status "completed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
ok   21 quotes with a completed callback all end "Кошторис готовий"
# 4. a failed callback of another n8n execution after a completed one
ok   completed, then failed (new jobId) -> page still "Кошторис готовий" — callbacks 202, 202; page "Кошторис готовий"
result: 17 ok, 1 FAIL
```

## `task-d/branch/review-after.txt`

Ті самі 18 перевірок на закомміченому коді після виправлень.

```text
# audit regression · 2026-quitcode-04-agent-skills-hw af2c1ae · build R-2HSGEmlyJaR9j-9eZr9 · pid 34916 · 2026-09-27T16:54:12Z
# 1. budget parsing (value that reached n8n, or a form error)
ok   budget "1500" -> 1500 — n8n got 1500
ok   budget "1 500" -> 1500 — n8n got 1500
ok   budget "1500,50" -> 1500.5 — n8n got 1500.5
ok   budget "1500.50" -> 1500.5 — n8n got 1500.5
ok   budget "1 500,5" -> 1500.5 — n8n got 1500.5
ok   budget "" -> null — n8n got null
ok   budget "1,2,3" -> form error — form error
ok   budget "1,500" -> form error — form error
ok   budget "1e3" -> form error — form error
ok   budget "0x10" -> form error — form error
ok   budget "-5" -> form error — form error
ok   budget "12345678901234" -> form error — form error
ok   budget "5                               0" -> form error — form error
# 2. signed callback: event suffix must match data.status
ok   quote-request.completed + status "failed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.failed + status "completed" -> 400 — got 400, page: Готуємо кошторис
ok   quote-request.completed + status "completed" -> 202 — got 202, page: Кошторис готовий
# 3. race: n8n calls back before answering 202, after 0..400 ms
ok   21 quotes with a completed callback all end "Кошторис готовий"
# 4. a failed callback of another n8n execution after a completed one
ok   completed, then failed (new jobId) -> page still "Кошторис готовий" — callbacks 202, 202; page "Кошторис готовий"
result: 18 ok, 0 FAIL
```

## `task-d/branch/review-config-log.txt`

Журнал запуску воркфлоу з `/webhook-test` в `N8N_WEBHOOK_BASE_URL` (тестове значення лише для цього прогону): тепер назва помилки замість «not-configured».

```text
# review fix: trigger error log names the error · 5b03b14+worktree · build Gx3_cZWmw34hBnOUGzlfN · 2026-09-27T16:53:40Z
N8N_WEBHOOK_BASE_URL set to a /webhook-test URL (test value, exported for this run only)
server log lines with n8n:
  | {"n8n":"out","event":"quote-request","correlationId":"c9f1f7fe-4170-47db-a97f-d596eb318c5d","status":"N8nConfigError"}
lines with the submitted email/company: 0
```

## `task-d/branch/scenario-after-code-review.txt`

Повний сценарій після виправлень за код-рев'ю.

```text
# scenario · copy 2026-quitcode-04-agent-skills-hw af2c1ae · build 3wJ0E8KA8JMlbZWyUgZUN · server pid 34989 · 2026-09-27T16:54:28Z
mock: tools/mock-n8n.mjs --mode respond-202 --delay 5000 (from the working repo, --env-file=.env.local of the copy)
.env.local keys (names only): N8N_WEBHOOK_BASE_URL N8N_WEBHOOK_TOKEN N8N_CALLBACK_SECRET APP_BASE_URL 
GET /quotes/new -> 200
form fields posted: $ACTION_REF_1 $ACTION_1:0 $ACTION_1:1 $ACTION_KEY company email description budget
no-JS POST /quotes/new -> HTTP 303 in 0.135003 s (TTFB 0.134833 s)
redirect / status page: /quotes/ed29a3cc-ee90-4796-9a07-67a9b104d708
mock log right after the POST:
  | [mock-n8n] 2026-09-27T16:54:28.603Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T16:54:28.604Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T16:54:28.604Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T16:54:28.604Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T16:54:28.604Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T16:54:29.013Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=988800f8f15c95fa345237f1d08fb52264135a4d4ed04f5fe5931398879107b8
  | [mock-n8n] 2026-09-27T16:54:29.013Z workflow 5985cc9c-a62a-4204-99c5-76c32fa4475b running for 5000 ms, then callback event=quote-request.completed
/quotes/<id> before the callback:  LeadDesk ← Studio Nova Кошторис для Scenario Test LLC Запит від 27 вер. 2026 р., 19:54 Готуємо кошторис Зазвичай це займає одну-дві хвилини. Сторінка оновиться сама. 
mock log after the workflow (--mode respond-202 --delay 5000), 7 s after the POST:
  | [mock-n8n] 2026-09-27T16:54:28.603Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
  | [mock-n8n] 2026-09-27T16:54:28.604Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
  | [mock-n8n] 2026-09-27T16:54:28.604Z test URLs: not registered (start with --listen to open them for 120 s)
  | [mock-n8n] 2026-09-27T16:54:28.604Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
  | [mock-n8n] 2026-09-27T16:54:28.604Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
  | [mock-n8n] 2026-09-27T16:54:29.013Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=988800f8f15c95fa345237f1d08fb52264135a4d4ed04f5fe5931398879107b8
  | [mock-n8n] 2026-09-27T16:54:29.013Z workflow 5985cc9c-a62a-4204-99c5-76c32fa4475b running for 5000 ms, then callback event=quote-request.completed
  | [mock-n8n] 2026-09-27T16:54:34.236Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 220 ms (try 1/3) event=quote-request.completed body 382 B sha256=ce8798943a294f5895606eaf5dbb9ee59aebab77b83805575a957085df2a86a7
/quotes/<id> after the callback:  LeadDesk ← Studio Nova Кошторис для Scenario Test LLC Запит від 27 вер. 2026 р., 19:54 Кошторис готовий Завантажте PDF за посиланням нижче. Завантажити PDF 
callback matrix (send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request, secret via --env-file):
  | send-signed-callback · http://127.0.0.1:3000/api/n8n/quote-request · event quote-request · success cases skipped (no --request-key)
  | ok   unknown event in the path                expected 404, got 404
  | ok   wrong content-type (text/plain)          expected 415, got 415
  | ok   body larger than 64 KB                   expected 413, got 413
  | ok   timestamp 301 s in the past              expected 401, got 401
  | ok   timestamp 301 s in the future            expected 401, got 401
  | ok   wrong signature                          expected 401, got 401
  | ok   body reformatted after signing           expected 401, got 401
  | 7/7 as expected
server log: 25 lines; lines with the submitted email / company / description: 0
server log lines mentioning n8n / quote / callback:
  | db:insertQuote: 1
  | {"n8n":"out","event":"quote-request","correlationId":"b99868b5-6e6f-4f8c-9a34-0d73a637d301","attempt":1,"status":202,"ms":13}
  | db:updateQuote: 1
  | db:getQuote: 1
  | db:claimCallbackKey: 1
  | db:getQuoteByRequestKey: 1
  | db:updateQuote: 2
  | {"n8n":"in","event":"quote-request","correlationId":"b99868b5-6e6f-4f8c-9a34-0d73a637d301","status":202,"bytes":382,"ms":187}
  | db:getQuote: 2
  | {"n8n":"in","event":"no-such-event-xyz","correlationId":"0f37b6f8-b9e2-4d91-be53-7ccd93717b3b","status":404,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"02507208-7b21-4cba-8e86-27911b613a50","status":415,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"8e1bcb1b-3bd8-4444-9882-ac83e7dc2a72","status":413,"bytes":0,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"06e590d9-916d-49c9-9adf-7db271f569ba","status":401,"bytes":382,"ms":1}
  | {"n8n":"in","event":"quote-request","correlationId":"24fd4f6c-ec64-416e-a9a1-2dd111232b72","status":401,"bytes":382,"ms":1}
  | {"n8n":"in","event":"quote-request","correlationId":"6a8a4575-83a8-4f08-b8fb-c9fddf42992a","status":401,"bytes":382,"ms":0}
  | {"n8n":"in","event":"quote-request","correlationId":"de866368-0e07-426d-a26c-9c38ec80dbaf","status":401,"bytes":447,"ms":0}
```

## `task-d/branch/check-contract-after-code-review.txt`

`check-contract.mjs` після виправлень за код-рев'ю.

```text
check-contract · root /Users/hryhorii_haponiuk/Desktop/Work Folder/Agentic Course/2026-quitcode-04-agent-skills-hw · full
n8n callers: lib/n8n/client.ts · callback routes: app/api/n8n/[event]/route.ts
C1   PASS no test webhook URL (/webhook-test/) in code or .env.example
C2   PASS no NEXT_PUBLIC_ variable for n8n / webhook / callback settings
C3   PASS requests to n8n only from lib/n8n/client.ts
C4   PASS the module that calls n8n starts with import "server-only"
C5   PASS every fetch to n8n has signal: AbortSignal.timeout(...)
C6   PASS requests to n8n send x-n8n-token, idempotency-key, x-correlation-id
C7   PASS request body is the envelope { version: 1, event, data }
C8   PASS a Server Action that triggers n8n does it inside after()
C9   PASS callback route reads the raw body; no request.json(), no JSON.parse before the signature check
C10  PASS callback signature: HMAC + length check + timingSafeEqual, never ===
C11  PASS callback timestamp checked against a 300 s window
C12  PASS callback idempotency-key read and bound to data.jobId of the signed body
C13  PASS no export const runtime = "edge"
C14  PASS no bodies, form data, personal data, tokens or signatures in console.* of n8n code
C15  PASS .env.example: N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN, N8N_CALLBACK_SECRET, APP_BASE_URL
Summary: 15 PASS, 0 FAIL, 0 N/A
```
