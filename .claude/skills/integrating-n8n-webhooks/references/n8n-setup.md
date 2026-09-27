# The n8n side — settings as text for the client

The client's workflow is the client's property: we do not export or import workflow JSON and do
not write n8n Code-node code. We hand over these settings in words (e.g. in the PR or a message).

1. **Webhook** — HTTP Method `POST`, Path = event name (`quote-request`).
   Authentication **Header Auth**, credential Name `x-n8n-token`, Value = `N8N_WEBHOOK_TOKEN`.
   A missing or wrong header is rejected with **403** "Authorization data is wrong!".
   Respond: `Using 'Respond to Webhook' Node` (fast "for info" events: `Immediately`).
   If the app host has fixed IPs: Options → IP(s) Allowlist (behind a reverse proxy set `N8N_PROXY_HOPS`).
   In later nodes the input is `$json.body`, headers `$json.headers` (lower-case names).
2. **Remove Duplicates** — "Remove Items Processed in Previous Executions", value
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook** — Respond With JSON, Response Code `202`,
   body `{"job_id": "{{ $execution.id }}"}`.
4. … the workflow's work (PDF, etc.) …
5. **Edit Fields** — `ts` = `{{ Math.floor($now.toSeconds()) }}`;
   `body` = `{{ JSON.stringify({ version: 1, event: 'quote-request.completed', data: { jobId: $execution.id, status: 'completed', correlationId: $('Webhook').item.json.headers['x-correlation-id'], requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'], result: { documentUrl: … }, completedAt: $now.toISO() } }) }}`.
   The body is signed and sent as **one and the same string**.
6. **Crypto** (v2) — Action `Hmac`, Type `SHA256`, Encoding `HEX`, value `{{ $json.ts + '.' + $json.body }}`,
   credential **Crypto** with Hmac Secret = `N8N_CALLBACK_SECRET`.
7. **HTTP Request** — `POST` to `{{ $('Webhook').item.json.body.callbackUrl }}`.
   Headers: `x-n8n-timestamp` = `ts`, `x-n8n-signature` = `sha256=` + Crypto result,
   `idempotency-key` = `{{ $execution.id }}:quote-request.completed` (same `jobId` and `event` as the body),
   `x-correlation-id` (from the incoming headers). Body Content Type **Raw**, Content Type
   `application/json`, Body = field `body`. Options → Timeout `10000`.
   Settings → Retry On Fail, Max Tries `3`, Wait Between Tries `1000`.
   If n8n runs in Docker and the app on the host — `host.docker.internal`, not `localhost`.
8. **Save** and **Publish**. Publish again after every change (n8n 2.x pins the published version).

Why Raw and not "JSON → Using Fields Below": n8n does not guarantee that serialising fields gives
exactly the bytes we signed.
