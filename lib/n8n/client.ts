import "server-only";

import { createHash } from "node:crypto";

// Next.js → n8n. The only module that calls n8n webhooks (contract: skill integrating-n8n-webhooks).

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // at most 2 retries: 3 attempts in total
const ENVELOPE_VERSION = 1;

/** kebab-case event = the Path of the n8n Webhook node. One event, one path. */
export type N8nEvent = "quote-request";

export type TriggerOptions = {
  /** Created once per business operation and stored with the record; the same on every retry. */
  idempotencyKey: string;
  /** One id for the whole chain; it goes into the logs of both systems. */
  correlationId: string;
  /** Async workflows only (Respond to Webhook → 202, result by callback). */
  callback?: boolean;
};

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | null; retryable: boolean };

export async function triggerWorkflow(
  event: N8nEvent,
  data: Record<string, unknown>,
  options: TriggerOptions,
): Promise<TriggerResult> {
  const url = `${env("N8N_WEBHOOK_BASE_URL").replace(/\/+$/, "")}/${event}`;
  const body = JSON.stringify({
    version: ENVELOPE_VERSION,
    event,
    data,
    ...(options.callback ? { callbackUrl: `${env("APP_BASE_URL").replace(/\/+$/, "")}/api/n8n/${event}` } : {}),
  });
  const headers = {
    "content-type": "application/json",
    "x-n8n-token": env("N8N_WEBHOOK_TOKEN"),
    "idempotency-key": options.idempotencyKey,
    "x-correlation-id": options.correlationId,
  };
  const bytes = Buffer.byteLength(body);
  const sha256 = createHash("sha256").update(body).digest("hex");

  let status: number | null = null;
  let retryable = true;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
      status = response.status;
      // Only the status code counts. The body is read for the job_id of a 202 and nothing else.
      const jobId = status === 202 ? await readJobId(response) : null;
      if (status !== 202) await response.body?.cancel();
      console.info("n8n.request", { event, correlationId: options.correlationId, attempt, status, ms: Date.now() - started, bytes, sha256 });
      if (response.ok) return { ok: true, status, jobId };
      // 5xx and n8n Cloud's 524 may pass on a retry. 4xx is a bug to fix, not to repeat:
      // 403 = wrong x-n8n-token, 404 = workflow not published, wrong path or a test URL.
      retryable = status >= 500;
    } catch (error) {
      // TimeoutError (AbortSignal.timeout) or a network error: retry with the same idempotency-key.
      status = null;
      retryable = true;
      console.warn("n8n.request_failed", {
        event,
        correlationId: options.correlationId,
        attempt,
        error: error instanceof Error ? error.name : "unknown",
        ms: Date.now() - started,
      });
    }
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (!retryable || delay === undefined) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return { ok: false, status, retryable };
}

async function readJobId(response: Response): Promise<string | null> {
  try {
    const value: unknown = await response.json();
    if (typeof value === "object" && value !== null && "job_id" in value) {
      const jobId = (value as { job_id: unknown }).job_id;
      if (typeof jobId === "string" || typeof jobId === "number") return String(jobId);
    }
  } catch {
    // Not JSON: the status code alone is the answer.
  }
  return null;
}

function env(name: "N8N_WEBHOOK_BASE_URL" | "N8N_WEBHOOK_TOKEN" | "APP_BASE_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`); // the name only, never a value
  return value;
}
