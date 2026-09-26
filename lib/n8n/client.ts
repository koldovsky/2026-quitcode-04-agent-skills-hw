import "server-only";

// The only place that calls n8n. Contract: .claude/skills/integrating-n8n-webhooks.

const RETRY_DELAYS_MS = [1_000, 3_000];

export type TriggerResult =
  | { ok: true; status: number; attempts: number }
  | { ok: false; status: number | null; attempts: number };

export async function triggerN8nWebhook(options: {
  event: string;                 // kebab-case, = webhook path in n8n
  data: Record<string, unknown>; // only what the workflow needs
  idempotencyKey: string;        // created once per operation; the same on retries
  correlationId: string;
  callback?: boolean;            // true for async workflows (202 + callback)
}): Promise<TriggerResult> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!base || !token || (options.callback && !process.env.APP_BASE_URL)) {
    console.error("n8n.webhook", { event: options.event, correlationId: options.correlationId, error: "not_configured" });
    return { ok: false, status: null, attempts: 0 };
  }

  const body = JSON.stringify({
    version: 1,
    event: options.event,
    data: options.data,
    ...(options.callback ? { callbackUrl: `${process.env.APP_BASE_URL}/api/n8n/${options.event}` } : {}),
  });

  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    let status: number | null = null;
    try {
      const res = await fetch(`${base}/${options.event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": options.correlationId,
        },
        body,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
        // A 3xx must not be followed: fetch would resend x-n8n-token to whatever host the Location names.
        redirect: "manual",
      });
      status = res.status;
      await res.body?.cancel(); // only the status matters, the text is not parsed
      if (res.ok) {
        console.info("n8n.webhook", { event: options.event, correlationId: options.correlationId, status, attempt, ms: Date.now() - started });
        return { ok: true, status, attempts: attempt };
      }
    } catch {
      // network error or TimeoutError — retryable
    }
    console.warn("n8n.webhook", { event: options.event, correlationId: options.correlationId, status, attempt, ms: Date.now() - started });
    const retryable = status === null || status >= 500; // 5xx and 524; 4xx is not retried
    if (!retryable || attempt > RETRY_DELAYS_MS.length) return { ok: false, status, attempts: attempt };
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
  }
}
