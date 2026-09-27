# Response modes of the n8n Webhook node

| Mode | What Next.js gets | When we use it |
|---|---|---|
| Immediately | 200 right after the request is received | "For your information" events where no result is needed: `lead-created`, analytics |
| When Last Node Finishes | Output of the last node after the workflow ends | Quick lookups (seconds) when the result is needed in the answer |
| Using 'Respond to Webhook' Node | Whatever the Respond to Webhook node sets (code, headers, body) | **Default for long tasks:** 202 `{"job_id": …}` at once, result via signed callback |
| Streaming | A response stream | Not used |

## The 100-second rule

Anything that may come close to **100 s** is asynchronous only (202 + callback). On n8n Cloud a
webhook that has not answered within 100 s ends with **524**; the workflow keeps running, but
Next.js never learns the result. **If you are not sure how long a workflow runs, it is async.**

Example: a workflow that "prepares a PDF and takes 40–90 s" → Respond to Webhook 202 + callback,
the page shows status `queued` → `ready`/`failed` from our own storage.

## Respond to Webhook details

- It fires once; further Respond to Webhook nodes are ignored.
- If the workflow ends before reaching it, n8n answers 200 with its default message; an error
  before it gives 500.
- For async we expect **202**. Treat any 2xx as "accepted", 4xx as a configuration error (no
  retry), 5xx/524/timeout/network as retryable.

## Choosing a mode — decision

1. Does the user need the workflow's result on this screen right now, and does it reliably take
   a few seconds? → When Last Node Finishes (still with the 10 s timeout).
2. No result needed → Immediately (still in `after()` so the form does not wait).
3. Otherwise → Respond to Webhook 202 + callback.
