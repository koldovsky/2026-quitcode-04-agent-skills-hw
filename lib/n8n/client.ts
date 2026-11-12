import "server-only";
import { randomUUID } from "node:crypto";

// The only module that calls n8n. Contract: .claude/skills/integrating-n8n-webhooks.

export type N8nEvent = "quote-request"; // kebab-case, one event = one webhook path

const ATTEMPT_TIMEOUT_MS = 10_000;
const RETRY_PAUSES_MS = [1_000, 3_000]; // at most 2 retries = 3 attempts

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`n8n: ${name} is not set`);
  return value;
}

export type TriggerResult =
  | { ok: true; status: number; attempts: number }
  | { ok: false; status: number | null; attempts: number };

/** Starts an n8n workflow. Call it from after(), never while the user waits. */
export async function triggerWorkflow<TData>(input: {
  event: N8nEvent;
  data: TData; // the minimum the workflow needs — not the whole record
  idempotencyKey: string; // created once per business operation and stored with the record
  correlationId?: string;
  callbackPath?: string; // e.g. "/api/n8n/quote-request" — only for async (202 + callback) workflows
}): Promise<TriggerResult> {
  const base = requireEnv("N8N_WEBHOOK_BASE_URL").replace(/\/+$/, "");
  if (!base.endsWith("/webhook")) throw new Error("n8n: N8N_WEBHOOK_BASE_URL must end with /webhook");
  const token = requireEnv("N8N_WEBHOOK_TOKEN");
  const correlationId = input.correlationId ?? randomUUID();
  const body = JSON.stringify({
    version: 1,
    event: input.event,
    data: input.data,
    ...(input.callbackPath && { callbackUrl: new URL(input.callbackPath, requireEnv("APP_BASE_URL")).toString() }),
  });

  let status: number | null = null;
  for (let attempt = 1; attempt <= RETRY_PAUSES_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(`${base}/${input.event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": input.idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        cache: "no-store",
      });
      status = response.status;
      await response.body?.cancel(); // status code only; the message text is not a contract
    } catch {
      status = null; // network error or TimeoutError
    }
    console.info(
      `n8n out event=${input.event} correlation=${correlationId} attempt=${attempt} status=${status ?? "network"} ms=${Date.now() - started}`,
    );
    if (status !== null && status >= 200 && status < 300) return { ok: true, status, attempts: attempt };
    const retryable = status === null || status >= 500; // includes 524; 4xx is a bug to fix, not to retry
    if (!retryable || attempt > RETRY_PAUSES_MS.length) return { ok: false, status, attempts: attempt };
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSES_MS[attempt - 1]));
  }
  return { ok: false, status, attempts: RETRY_PAUSES_MS.length + 1 };
}
