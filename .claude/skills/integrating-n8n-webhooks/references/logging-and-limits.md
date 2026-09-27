# Logging and limits

## Logs

| Write | Never write |
|---|---|
| event, direction (`out` / `callback`), `x-correlation-id`, record id | request or response body |
| status code, duration, attempt number | name, email, phone, IP of the client |
| body length and its sha256 | token, signature, secret, full URL with query string |

- One line per attempt / callback, e.g.
  `n8n out event=quote-request id=q_0042 corr=9b1e… attempt=1 status=202 ms=18`.
- On failure log `error.name` (`TimeoutError`, `TypeError`) — not the request.
- Error responses to clients contain no internals: no stack, SQL, n8n URL, secret names with values.
- Never `console.log(formData)`, `console.log(body)`, `console.log(process.env…)`.

## Limits

| Limit | Value | Where from |
|---|---|---|
| Body of a request to an n8n webhook | 16 MB (`N8N_PAYLOAD_SIZE_MAX`, adjustable on self-hosted) | n8n Webhook docs |
| Server Action body | 1 MB by default (`serverActions.bodySizeLimit`) | Next.js Server Actions guide |
| Webhook response on n8n Cloud | 100 s, then 524 | n8n Webhook common issues |
| Test URL | 120 s after "Listen for test event" | n8n workflow development docs |
| Callback into Next.js | 64 KB, timestamp window 300 s | team decision |
| Our timeout per attempt | 10 s, 3 attempts max (pauses 1 s, 3 s) | team decision |

Files are never sent — only links to them.
