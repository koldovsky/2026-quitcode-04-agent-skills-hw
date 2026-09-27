# The n8n side, in words

The client's workflow is the client's property: we don't export, import or edit workflow JSON, and
we don't write Code nodes. We hand the human (or the client) this setup as text, adapted to the
event. Replace `quote-request` with the event's path.

## Contents

1. Credentials
2. Nodes, in order
3. Why these choices
4. Checklist for the hand-over
5. Sources

## 1. Credentials

| Credential | Type | Field | Value |
|---|---|---|---|
| "App → n8n token" | Header Auth | Name: `x-n8n-token`, Value | the same value as `N8N_WEBHOOK_TOKEN` in the app |
| "Callback HMAC" | Crypto | Hmac Secret | the same value as `N8N_CALLBACK_SECRET` in the app |

The human enters the values in both places. They never go into the workflow as plain text, a chat
or a ticket.

## 2. Nodes, in order

1. **Webhook**: HTTP Method `POST`, Path `quote-request`. Authentication **Header Auth** with the
   "App → n8n token" credential (a wrong or missing header is rejected with 403). Respond: **Using
   'Respond to Webhook' Node** (for a fire-and-forget event: Immediately). Optional: if the app's
   hosting has fixed IPs, Options → IP(s) Allowlist (behind a reverse proxy also set
   `N8N_PROXY_HOPS`). In later nodes the body is `$json.body`, the headers are `$json.headers`
   (lower-case names).
2. **Remove Duplicates**: Operation "Remove Items Processed in Previous Executions", value to
   dedupe on: `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook**: Respond With **JSON**, Response Code **202**, Response Body
   `{"job_id": "{{ $execution.id }}"}`.
4. … the workflow's own work (build the PDF, …) …
5. **Edit Fields (Set)**: two fields.
   - `ts` = `{{ Math.floor($now.toSeconds()) }}`
   - `body` =
     ```
     {{ JSON.stringify({
       version: 1,
       event: 'quote-request.completed',
       data: {
         jobId: $execution.id,
         status: 'completed',
         correlationId: $('Webhook').item.json.headers['x-correlation-id'],
         requestIdempotencyKey: $('Webhook').item.json.headers['idempotency-key'],
         result: { documentUrl: '<link to the file>' },
         completedAt: $now.toISO()
       }
     }) }}
     ```
   The body is signed and sent as **one and the same string**.
6. **Crypto** (v2): Action **Hmac**, Type **SHA256**, Encoding **HEX**, Value
   `{{ $json.ts + '.' + $json.body }}`, Property Name `signature`, credential "Callback HMAC".
7. **HTTP Request**: Method `POST`, URL `{{ $('Webhook').item.json.body.callbackUrl }}`.
   - Headers: `x-n8n-timestamp` = `{{ $json.ts }}`; `x-n8n-signature` = `sha256={{ $json.signature }}`;
     `idempotency-key` = `{{ $execution.id }}:quote-request.completed` (the same `jobId` and `event`
     as in the body); `x-correlation-id` = `{{ $('Webhook').item.json.headers['x-correlation-id'] }}`.
   - Body Content Type **Raw**, Content Type `application/json`, Body `{{ $json.body }}`.
   - Options → Timeout `10000`. Settings → **Retry On Fail**, Max Tries `3`, Wait Between Tries
     `1000`.
   - n8n in Docker, app on the host: the app's `APP_BASE_URL` uses `host.docker.internal`, not
     `localhost`.
8. **Save**, then **Publish**. After every later change: Publish again.

For a failure branch (the workflow's own error path), send the same callback with
`event: 'quote-request.failed'`, `status: 'failed'` and `error: { code: '<short code>' }` instead of
`result`, and the key `{{ $execution.id }}:quote-request.failed`.

## 3. Why these choices

- **Raw body, not "JSON → Using Fields Below":** the n8n docs don't promise that serialising fields
  gives exactly the bytes we signed. One string for both the signature and the body avoids that.
- **Respond to Webhook right after Remove Duplicates:** the 202 leaves before the slow work, so
  n8n Cloud's 100-second limit never applies.
- **Remove Duplicates on `idempotency-key`:** the app retries with the same key; without this node
  every retry would start one more workflow run.
- **Retry On Fail on the callback:** the app answers a repeat with 200 `{"duplicate": true}`, so
  retrying is always safe.
- **Publish after every change:** in n8n 2.x production calls go to the published version, not to
  the latest edits.

## 4. Checklist for the hand-over

Put this in the final answer for the human:

```
- [ ] Credentials: Header Auth (x-n8n-token) and Crypto (Hmac Secret) created, values = .env.local
- [ ] Webhook: POST, path <event>, Header Auth, Respond = Using 'Respond to Webhook' Node
- [ ] Remove Duplicates on {{ $json.headers['idempotency-key'] }}
- [ ] Respond to Webhook: JSON, 202, {"job_id": "{{ $execution.id }}"}
- [ ] Edit Fields ts + body → Crypto HMAC SHA256 HEX over ts + '.' + body
- [ ] HTTP Request to callbackUrl: 4 headers, Raw body, timeout 10000, Retry On Fail 3 × 1000 ms
- [ ] Saved and Published; the app's .env.local has the production /webhook base URL
- [ ] Row added to docs/n8n-integrations.md
```

## 5. Sources

- [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) ·
  [Webhook credentials (Header Auth, 403)](https://docs.n8n.io/integrations/builtin/credentials/webhook/) ·
  [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/) ·
  [Remove Duplicates](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.removeduplicates/) ·
  [Crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/) ·
  [Crypto credential](https://docs.n8n.io/integrations/builtin/credentials/crypto/) ·
  [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) ·
  [save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows)
