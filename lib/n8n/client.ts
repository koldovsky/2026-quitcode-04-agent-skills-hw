import "server-only";

const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000];

export type N8nEvent = "quote-request" | "lead-created";

type CallN8nWorkflowInput = {
  event: N8nEvent;
  data: Record<string, unknown>;
  idempotencyKey: string;
  correlationId: string;
  callbackUrl?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status >= 500 || status === 524;
}

function isRetryableError(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "TypeError");
}

async function attemptOnce(url: string, body: string, headers: HeadersInit) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { ok: response.status < 400, retryable: isRetryableStatus(response.status), status: response.status as number | null };
  } catch (error) {
    return { ok: false, retryable: isRetryableError(error), status: null as number | null };
  }
}

// Fires the outgoing webhook that starts an n8n workflow. Long workflows only
// ever respond 202 here; the real result comes back through the callback
// route, never through this call's response body (see known-pitfalls.md).
export async function callN8nWorkflow(input: CallN8nWorkflowInput): Promise<void> {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("N8N_WEBHOOK_BASE_URL / N8N_WEBHOOK_TOKEN is not configured");
  }

  const url = `${baseUrl}/${input.event}`;
  const body = JSON.stringify({
    version: 1,
    event: input.event,
    data: input.data,
    ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
  });
  const headers: HeadersInit = {
    "content-type": "application/json",
    "x-n8n-token": token,
    "idempotency-key": input.idempotencyKey,
    "x-correlation-id": input.correlationId,
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const result = await attemptOnce(url, body, headers);
    if (result.ok) return;
    if (!result.retryable || attempt === RETRY_DELAYS_MS.length) {
      throw new Error(
        `n8n webhook "${input.event}" failed${result.status ? ` with status ${result.status}` : ""}`,
      );
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}
