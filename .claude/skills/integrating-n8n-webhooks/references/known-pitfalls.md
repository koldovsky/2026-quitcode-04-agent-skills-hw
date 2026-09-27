# Відомі пастки в документації й чужих скілах

- «Workflow got started» (документація n8n) проти `Workflow was started` (код n8n) —
  тому текст відповіді Immediately-режиму не парсимо, дивимось лише код статусу.
- Офіційний пакет скілів n8n пише, що Header Auth відхиляє запит з **401**; код n8n
  повертає **403** («Authorization data is wrong!»). 401 — для Basic Auth і JWT.
- Той самий пакет пише, що секрет вузла Crypto не прив'язується до credential. Для
  Crypto v2 це вже не так: документація й код використовують Hmac Secret із Crypto
  credential.
- Приклад вебхука в документації Next.js передає токен у `?token=` у GET-запиті й
  порівнює через `!==`. Той самий гайд попереджає, що GET-запити можуть кешуватись і
  потрапляти в журнали. Ми робимо суворіше: токен у заголовку, підпис і
  `timingSafeEqual`.

## Джерела (для довідки, не перечитувати щоразу)

- n8n: [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) ·
  [Workflow development](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/workflow-development/) ·
  [Common issues](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/common-issues/) ·
  [Webhook credentials](https://docs.n8n.io/integrations/builtin/credentials/webhook/) ·
  [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/) ·
  [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) ·
  [Crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/) ·
  [Crypto credential](https://docs.n8n.io/integrations/builtin/credentials/crypto/) ·
  [Remove Duplicates](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.removeduplicates/) ·
  [Save and publish](https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows) ·
  [Endpoints env](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints)
- Код n8n: [Webhook/utils.ts](https://github.com/n8n-io/n8n/blob/HEAD/packages/nodes-base/nodes/Webhook/utils.ts) (403 для Header Auth) ·
  [webhook-on-received-response-extractor.ts](https://github.com/n8n-io/n8n/blob/HEAD/packages/cli/src/webhooks/webhook-on-received-response-extractor.ts) (текст Immediately)
- Next.js 16: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) ·
  [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) ·
  [Server Actions](https://nextjs.org/docs/app/guides/server-actions) ·
  [Environment variables](https://nextjs.org/docs/app/guides/environment-variables) ·
  [after](https://nextjs.org/docs/app/api-reference/functions/after) ·
  [runtime](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)
- Node.js / Web: [crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) ·
  [AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)