import "server-only";

// Single door out to n8n. Direct fetch()es to n8n belong nowhere else — see
// .claude/skills/integrating-n8n-webhooks/references/env-and-request.md.

const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000];

type SendEventInput = {
  event: string;
  data: Record<string, unknown>;
  callbackUrl?: string;
  idempotencyKey: string;
  correlationId: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status >= 500 || status === 524;
}

/**
 * Fires a workflow event at n8n. Never throws — a failed send is logged and
 * left for the caller to notice (e.g. the quote page never leaves "queued").
 * Runs from `after()`, so nothing downstream is waiting on this promise.
 */
export async function sendN8nEvent({ event, data, callbackUrl, idempotencyKey, correlationId }: SendEventInput) {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!baseUrl || !token) {
    console.error(`n8n:${event} not configured`, { correlationId });
    return;
  }

  const body = JSON.stringify({
    version: 1,
    event,
    data,
    ...(callbackUrl ? { callbackUrl } : {}),
  });

  for (let attempt = 0; ; attempt++) {
    let status: number | null = null;

    try {
      const response = await fetch(`${baseUrl}/${event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      status = response.status;
    } catch (error) {
      console.error(`n8n:${event} request failed`, {
        correlationId,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (status !== null && status >= 200 && status < 300) {
      console.log(`n8n:${event} accepted`, { correlationId, attempt, status });
      return;
    }

    const retryable = status === null || isRetryableStatus(status);
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
      console.error(`n8n:${event} gave up`, { correlationId, attempt, status });
      return;
    }

    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}
