import "server-only";
import { createHash, randomUUID } from "node:crypto";

// The only module that calls n8n (skill integrating-n8n-webhooks, references/contract.md).
// Server-only: importing it from a Client Component fails the build.

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // at most 2 retries

export type TriggerOptions = {
  idempotencyKey: string; // UUID created once per business operation, stored with the record
  correlationId?: string;
  callbackUrl?: string; // async workflows only
};

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | null; reason: "not-configured" | "rejected" | "unavailable" };

export function n8nCallbackUrl(event: string): string | null {
  const base = process.env.APP_BASE_URL;
  return base ? `${base.replace(/\/+$/, "")}/api/n8n/${event}` : null;
}

const retryable = (status: number) => status >= 500; // 5xx incl. 524; never 4xx

export async function triggerWorkflow(
  event: string,
  data: Record<string, unknown>,
  options: TriggerOptions,
): Promise<TriggerResult> {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const correlationId = options.correlationId ?? randomUUID();
  if (!baseUrl || !token) {
    console.warn(`n8n -> ${event} skipped: N8N_WEBHOOK_BASE_URL or N8N_WEBHOOK_TOKEN is not set corr=${correlationId}`);
    return { ok: false, status: null, reason: "not-configured" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/${event}`;
  const envelope = JSON.stringify({
    version: 1,
    event,
    data,
    ...(options.callbackUrl ? { callbackUrl: options.callbackUrl } : {}),
  });
  const size = `${Buffer.byteLength(envelope)} B sha256=${createHash("sha256").update(envelope).digest("hex").slice(0, 16)}`;
  const tries = RETRY_DELAYS_MS.length + 1;
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= tries; attempt++) {
    const started = Date.now();
    let outcome: string;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body: envelope,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const answer = await response.text(); // only job_id is read, and only from a 202
      lastStatus = response.status;
      outcome = String(response.status);
      console.info(`n8n -> ${event} ${outcome} in ${Date.now() - started} ms (try ${attempt}/${tries}) corr=${correlationId} ${size}`);
      if (response.ok) {
        return { ok: true, status: response.status, jobId: response.status === 202 ? readJobId(answer) : null };
      }
      if (!retryable(response.status)) return { ok: false, status: response.status, reason: "rejected" };
    } catch (error) {
      outcome = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network error";
      console.warn(`n8n -> ${event} ${outcome} after ${Date.now() - started} ms (try ${attempt}/${tries}) corr=${correlationId}`);
    }
    if (attempt < tries) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
  }
  return { ok: false, status: lastStatus, reason: "unavailable" };
}

function readJobId(answer: string): string | null {
  try {
    const value = JSON.parse(answer) as { job_id?: unknown };
    return typeof value.job_id === "string" ? value.job_id : null;
  } catch {
    return null;
  }
}
