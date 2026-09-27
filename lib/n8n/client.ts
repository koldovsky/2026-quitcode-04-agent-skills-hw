import "server-only";

// The only module that talks to n8n. Contract: .claude/skills/integrating-n8n-webhooks.

// Thrown before any request when a setting is missing or wrong; callers log its name, never the message.
export class N8nConfigError extends Error {
  name = "N8nConfigError";
}

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 retries -> 3 attempts in total

export type TriggerResult =
  | { ok: true; status: number }
  | { ok: false; status: number | null; reason: "rejected" | "unavailable" };

type TriggerOptions = {
  idempotencyKey: string; // created once per business operation and stored with the record
  correlationId: string;
  callback?: boolean; // async workflow: n8n answers 202 and calls back later
};

export async function triggerWorkflow(
  event: string,
  data: Record<string, unknown>,
  { idempotencyKey, correlationId, callback = false }: TriggerOptions,
): Promise<TriggerResult> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!base || !token) throw new N8nConfigError("n8n is not configured (N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN)");
  if (base.includes("/webhook-test")) throw new N8nConfigError("N8N_WEBHOOK_BASE_URL must be a production /webhook URL");

  const envelope: Record<string, unknown> = { version: 1, event, data };
  if (callback) {
    const app = process.env.APP_BASE_URL;
    if (!app) throw new N8nConfigError("APP_BASE_URL is not configured");
    envelope.callbackUrl = `${app.replace(/\/+$/, "")}/api/n8n/${event}`;
  }
  const body = JSON.stringify(envelope);
  const url = `${base.replace(/\/+$/, "")}/${event}`;

  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus = response.status;
      await response.body?.cancel(); // only the status code matters, never the text
      logCall(event, correlationId, attempt, response.status, started);
      if (response.ok) return { ok: true, status: response.status };
      if (response.status < 500) return { ok: false, status: response.status, reason: "rejected" }; // 4xx: fix, do not retry
    } catch (error) {
      // network error or TimeoutError: retry with the same idempotency key
      logCall(event, correlationId, attempt, error instanceof Error ? error.name : "error", started);
    }
    const pause = RETRY_DELAYS_MS[attempt - 1];
    if (pause !== undefined) await new Promise((resolve) => setTimeout(resolve, pause));
  }
  return { ok: false, status: lastStatus, reason: "unavailable" };
}

// Event, direction, correlation id, attempt, status, duration. Never bodies, tokens, URLs or personal data.
function logCall(event: string, correlationId: string, attempt: number, status: number | string, started: number) {
  console.info(
    JSON.stringify({ n8n: "out", event, correlationId, attempt, status, ms: Date.now() - started }),
  );
}
