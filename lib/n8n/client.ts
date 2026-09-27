import "server-only";
import { randomUUID } from "node:crypto";

// The only module that calls n8n. Contract: .claude/skills/integrating-n8n-webhooks.

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // up to 2 retries → 3 attempts

export type N8nEvent = "quote-request" | "lead-created"; // one kebab-case path per event

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
  if (!baseUrl || !token || (options.callbackPath && !appBaseUrl)) throw configError("N8nNotConfigured", "n8n is not configured");
  // Rejected before any request: the token must not travel over plain http to another host.
  if (!isSafeWebhookBase(baseUrl)) throw configError("N8nInsecureBaseUrl", "N8N_WEBHOOK_BASE_URL must be https (http only for localhost)");

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

// x-n8n-token goes in a header: https for n8n anywhere else, plain http only on this machine
// (the local mock).
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isSafeWebhookBase(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
  } catch {
    return false;
  }
}

// Callers log only error.name, so each configuration problem gets its own name (no values in it).
function configError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function logAttempt(event: string, correlationId: string, status: number | string, ms: number, attempt: number) {
  // No bodies, names, emails, tokens or URLs with query strings.
  console.info("n8n.out", { event, correlationId, status, ms, attempt });
}
