import "server-only";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // max 2 retries → 3 attempts

export type TriggerOptions = {
  idempotencyKey: string; // created once per business operation and stored with the record
  correlationId: string;
  callback?: boolean; // async workflow: n8n answers 202 {job_id} and calls back later
};

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | null };

function config() {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace(/\/+$/, "");
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!baseUrl || !token) throw new Error("n8n is not configured: set N8N_WEBHOOK_BASE_URL and N8N_WEBHOOK_TOKEN");
  if (!baseUrl.endsWith("/webhook")) throw new Error("N8N_WEBHOOK_BASE_URL must be the production base ending with /webhook");
  return { baseUrl, token };
}

export function callbackUrl(event: string) {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  if (!appBaseUrl) throw new Error("APP_BASE_URL is not set");
  return `${appBaseUrl}/api/n8n/${event}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry only transient failures: network errors, timeouts, 5xx (incl. Cloud 524). Never 4xx.
const isRetryable = (status: number) => status >= 500;

export async function triggerWorkflow<T>(event: string, data: T, options: TriggerOptions): Promise<TriggerResult> {
  const { baseUrl, token } = config();
  const body = JSON.stringify({
    version: 1,
    event,
    data, // the minimum the workflow needs — never the whole DB row
    ...(options.callback ? { callbackUrl: callbackUrl(event) } : {}),
  });

  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(`${baseUrl}/${event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": options.idempotencyKey,
          "x-correlation-id": options.correlationId,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus = response.status;
      console.info(`[n8n] out event=${event} attempt=${attempt} status=${response.status} ms=${Date.now() - started} correlation=${options.correlationId}`);
      if (response.ok) {
        // Only the status code and job_id matter; the message text is not a contract.
        const jobId = response.status === 202 ? await readJobId(response) : null;
        return { ok: true, status: response.status, jobId };
      }
      if (!isRetryable(response.status)) return { ok: false, status: response.status };
    } catch (error) {
      // TimeoutError / network error: log the kind only, never the URL, headers or body.
      console.warn(`[n8n] out event=${event} attempt=${attempt} error=${error instanceof Error ? error.name : "unknown"} ms=${Date.now() - started} correlation=${options.correlationId}`);
    }
    if (attempt <= RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }
  return { ok: false, status: lastStatus };
}

async function readJobId(response: Response) {
  const json: unknown = await response.json().catch(() => null);
  const jobId = (json as { job_id?: unknown } | null)?.job_id;
  return typeof jobId === "string" ? jobId : null;
}
