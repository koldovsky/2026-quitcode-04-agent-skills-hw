import "server-only";
import { randomUUID } from "node:crypto";

// The only module that calls n8n. Contract: .claude/skills/integrating-n8n-webhooks.

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // up to 2 retries → 3 attempts

export type N8nEvent = "quote-request"; // one kebab-case path per event

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | "network" | "timeout"; attempts: number };

export async function triggerWorkflow(
  event: N8nEvent,
  data: Record<string, unknown>,
  options: { idempotencyKey: string; correlationId?: string; callbackPath?: string },
): Promise<TriggerResult> {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const appBaseUrl = process.env.APP_BASE_URL;
  // Without APP_BASE_URL the callback would go to "undefined/api/n8n/…" and never arrive.
  if (!baseUrl || !token || (options.callbackPath && !appBaseUrl)) throw new Error("n8n is not configured");

  const correlationId = options.correlationId ?? randomUUID();
  const payload = JSON.stringify({
    version: 1,
    event,
    data,
    ...(options.callbackPath ? { callbackUrl: `${appBaseUrl}${options.callbackPath}` } : {}),
  });

  for (let attempt = 1; ; attempt++) {
    const startedAt = Date.now();
    let status: number | "network" | "timeout";
    try {
      const response = await fetch(`${baseUrl}/${event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = response.status;
      logAttempt(event, correlationId, status, Date.now() - startedAt, attempt);
      if (response.ok) {
        // Only the status code matters; a 202 from "Respond to Webhook" carries {"job_id": …}.
        const jobId =
          response.status === 202
            ? (((await response.json().catch(() => null)) as { job_id?: unknown } | null)?.job_id ?? null)
            : null;
        return { ok: true, status: response.status, jobId: typeof jobId === "string" ? jobId : null };
      }
    } catch (error) {
      status = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network";
      logAttempt(event, correlationId, status, Date.now() - startedAt, attempt);
    }

    const retryable = typeof status !== "number" || status >= 500; // network, timeout, 5xx, 524
    if (!retryable || attempt > RETRY_DELAYS_MS.length) return { ok: false, status, attempts: attempt };
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
  }
}

function logAttempt(event: string, correlationId: string, status: number | string, ms: number, attempt: number) {
  // No bodies, names, emails, tokens or URLs with query strings.
  console.info("n8n.out", { event, correlationId, status, ms, attempt });
}
