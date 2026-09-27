import "server-only";

// The only module that sends requests to n8n. Everything else calls triggerWorkflow().
// Judge the response by status code only — never by the message text (contract §4).

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 retries → 3 attempts max

export type TriggerResult =
  | { ok: true; status: number; attempts: number }
  | {
      ok: false;
      status: number | null;
      attempts: number;
      reason: "config" | "http" | "timeout" | "network";
    };

type TriggerInput<T> = {
  event: string; // kebab-case, e.g. "quote-request" → POST {base}/quote-request
  data: T; // minimum the workflow needs — never the DB row
  idempotencyKey: string; // created once per business operation and stored with the record
  correlationId: string;
  withCallback?: boolean; // async workflows: adds callbackUrl = {APP_BASE_URL}/api/n8n/{event}
};

function readConfig() {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!base || !token || !appBaseUrl) return null;
  if (base.includes("/webhook-test")) return null; // test URLs never in code paths
  return { base: base.replace(/\/+$/, ""), token, appBaseUrl: appBaseUrl.replace(/\/+$/, "") };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(status: number) {
  return status >= 500; // includes 524 from n8n Cloud; 4xx are configuration errors
}

export async function triggerWorkflow<T>(input: TriggerInput<T>): Promise<TriggerResult> {
  const config = readConfig();
  if (!config) {
    console.error(`n8n config missing or invalid event=${input.event}`); // names only, no values
    return { ok: false, status: null, attempts: 0, reason: "config" };
  }

  const body = JSON.stringify({
    version: 1,
    event: input.event,
    data: input.data,
    ...(input.withCallback ? { callbackUrl: `${config.appBaseUrl}/api/n8n/${input.event}` } : {}),
  });

  let last: TriggerResult = { ok: false, status: null, attempts: 0, reason: "network" };
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(`${config.base}/${input.event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": config.token,
          "idempotency-key": input.idempotencyKey,
          "x-correlation-id": input.correlationId,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Status code only — never parse the message text.
      console.info(
        `n8n out event=${input.event} corr=${input.correlationId} attempt=${attempt} status=${response.status} ms=${Date.now() - started}`,
      );
      if (response.ok) return { ok: true, status: response.status, attempts: attempt };
      last = { ok: false, status: response.status, attempts: attempt, reason: "http" };
      if (!isRetryable(response.status)) return last;
    } catch (error) {
      const name = error instanceof Error ? error.name : "Error";
      const reason = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
      console.warn(
        `n8n out event=${input.event} corr=${input.correlationId} attempt=${attempt} error=${name} ms=${Date.now() - started}`,
      );
      last = { ok: false, status: null, attempts: attempt, reason };
    }
    const pause = RETRY_DELAYS_MS[attempt - 1];
    if (pause !== undefined) await sleep(pause);
  }
  return last;
}
