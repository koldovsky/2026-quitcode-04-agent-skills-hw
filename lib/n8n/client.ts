import "server-only";
import { randomUUID } from "node:crypto";

// The only module that talks to n8n webhooks (contract: skill integrating-n8n-webhooks).
const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 retries = 3 attempts, only network/timeout/5xx/524

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | "timeout" | "network" };

export type TriggerOptions = {
  /** Created once per business operation and stored with the record; the same on every retry. */
  idempotencyKey: string;
  /** Chain id for the logs of both systems; generated if absent. */
  correlationId?: string;
  /** Async workflows only: path of our callback route, e.g. "/api/n8n/quote-request". */
  callbackPath?: string;
};

function requireEnv(name: "N8N_WEBHOOK_BASE_URL" | "N8N_WEBHOOK_TOKEN" | "APP_BASE_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function triggerWorkflow(
  event: string,
  data: Record<string, unknown>,
  options: TriggerOptions,
): Promise<TriggerResult> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(event)) throw new Error("n8n event must be kebab-case");
  const url = `${requireEnv("N8N_WEBHOOK_BASE_URL").replace(/\/+$/, "")}/${event}`;
  const correlationId = options.correlationId ?? randomUUID();
  const envelope = JSON.stringify({
    version: 1,
    event,
    data,
    ...(options.callbackPath
      ? { callbackUrl: new URL(options.callbackPath, requireEnv("APP_BASE_URL")).toString() }
      : {}),
  });

  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    let result: TriggerResult;
    let retryable = false;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": requireEnv("N8N_WEBHOOK_TOKEN"),
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body: envelope,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Only the status code matters; the message text differs between n8n versions.
      let jobId: string | null = null;
      if (response.status === 202) {
        const json = (await response.json().catch(() => null)) as { job_id?: unknown } | null;
        jobId = typeof json?.job_id === "string" ? json.job_id : null;
      }
      result = response.ok ? { ok: true, status: response.status, jobId } : { ok: false, status: response.status };
      retryable = response.status >= 500; // 5xx and 524; never 4xx (403 token, 404 not published / test URL)
    } catch (error) {
      result = { ok: false, status: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" };
      retryable = true;
    }
    // Event, direction, correlation id, status, duration, attempt: never the body, contacts or the token.
    console.info(
      `n8n out event=${event} correlation=${correlationId} attempt=${attempt} status=${result.status} ms=${Date.now() - started}`,
    );
    if (result.ok || !retryable || attempt > RETRY_DELAYS_MS.length) return result;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
  }
}
