# Response modes, timeouts, test and production URLs

How to choose between a synchronous answer and 202 + callback, and which URL the code may use.

## Contents

1. The four response modes of the Webhook node
2. Choosing a mode
3. The 100-second rule
4. How Respond to Webhook behaves
5. What the app sees, and how the mock reproduces it
6. Test URL vs production URL
7. Sources

## 1. The four response modes of the Webhook node

| Mode ("Respond") | What Next.js gets | When we use it |
|---|---|---|
| Immediately | 200 right after n8n receives the request | "For information" events whose result nobody waits for: `lead-created`, analytics |
| When Last Node Finishes | Output of the last node, once the workflow is done | A quick lookup (seconds) whose result is needed in this response |
| Using 'Respond to Webhook' Node | Whatever the Respond to Webhook node sets: code, headers, body | **The standard for long jobs:** 202 `{"job_id": …}` at once, the result by callback |
| Streaming | A streamed response | Not used |

## 2. Choosing a mode

1. Nobody needs the result → **Immediately**.
2. The result is needed, the workflow reliably takes seconds, and the caller can wait → **When Last
   Node Finishes**. The caller is a Route Handler or code inside `after()`, never a Server Action
   body the user is waiting for.
3. Anything that may approach 100 seconds, or **whose duration you don't know** → **Respond to
   Webhook 202 + callback**. "Unknown" counts as long.

A PDF, an AI step, a third-party API with queues, "40–90 seconds": all of these are case 3. Raising
timeouts or waiting longer is not an option: past 100 s, n8n Cloud cuts the connection anyway.

## 3. The 100-second rule

On n8n Cloud, a webhook request that hasn't been answered within **100 seconds** ends with **524**.
The workflow keeps running, but Next.js never learns its result. A synchronous design that works
locally (no such limit on the mock without `--cloud-timeout`, or on a self-hosted n8n without a
proxy) fails in production.

## 4. How Respond to Webhook behaves

- It fires once. Any later Respond to Webhook nodes in the same execution are ignored.
- If the workflow finishes without reaching it, n8n answers 200 with its standard message. If the
  workflow fails before it, n8n answers 500.
- Place it right after Webhook → Remove Duplicates, before the slow work, so the 202 goes out
  immediately.

## 5. What the app sees, and how the mock reproduces it

| n8n setup | Status the client gets | Mock |
|---|---|---|
| Immediately | 200 `{"message":"Workflow was started"}` | `--mode immediately` (default) |
| When Last Node Finishes | 200 + the last node's output, after the workflow | `--mode last-node` (2 s by default) |
| Respond to Webhook 202 | 202 `{"job_id":"…"}`, callback later | `--mode respond-202` (+ `--delay`, secrets from `--env-file`) |
| long synchronous workflow on Cloud | 524 after 100 s | `--mode slow --cloud-timeout 5000` |
| wrong or missing `x-n8n-token` | 403 `Authorization data is wrong!` | `N8N_WEBHOOK_TOKEN` set for the mock, wrong value in the app |
| test URL outside its 120 s window, unpublished workflow | 404 | `/webhook-test/…` without `--listen` |

The client reads only the status code (plus `job_id` of a 202), so the exact message text doesn't
matter.

## 6. Test URL vs production URL

| | Test URL | Production URL |
|---|---|---|
| Path | `/webhook-test/<path>` | `/webhook/<path>` |
| Works | for **120 s** after "Listen for test event" in the editor (or a manual run) | while the workflow is **published** |
| Data visible in the editor | yes | no (Executions list) |

- Code and `.env.example` use **only** `/webhook`. The typical failure: a test URL lands in `.env`,
  everything works while someone has the editor open, and then requests are silently lost (404).
- The one exception: a developer may put the test URL into their **own** `.env.local` for a few
  minutes, to watch the data arrive in the editor. It never reaches git.
- **n8n 2.x:** publishing pins a specific version of the workflow. Production calls go to that
  version, not to the latest edits. After every change: Save **and** Publish.
- A self-hosted n8n can rename both path segments (`N8N_ENDPOINT_WEBHOOK`,
  `N8N_ENDPOINT_WEBHOOK_TEST`). If the client did, `N8N_WEBHOOK_BASE_URL` ends with their name, and
  the project's `docs/n8n-integrations.md` says so.

## 7. Sources

- [Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) ·
  [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/) ·
  [common issues (100 s, 524, one webhook per path)](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) ·
  [workflow development (test URL, 120 s)](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/) ·
  [save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows) ·
  [endpoints env](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints)
- n8n code: [webhook-on-received-response-extractor.ts](https://github.com/n8n-io/n8n/blob/HEAD/packages/cli/src/webhooks/webhook-on-received-response-extractor.ts)
  ("Workflow was started")
