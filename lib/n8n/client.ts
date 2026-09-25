import "server-only";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 повтори = 3 спроби

export type TriggerOptions = {
  idempotencyKey: string; // створений один раз і збережений разом із записом
  correlationId: string;
  withCallback: boolean; // true для довгих воркфлоу (202 + колбек)
};

export type TriggerResult =
  | { ok: true; status: number }
  | { ok: false; status: number | null };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function triggerWorkflow(
  event: string,
  data: Record<string, unknown>,
  { idempotencyKey, correlationId, withCallback }: TriggerOptions,
): Promise<TriggerResult> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!base || !token || (withCallback && !appBaseUrl)) {
    throw new Error("n8n is not configured: set N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_TOKEN and APP_BASE_URL");
  }

  const envelope = JSON.stringify({
    version: 1,
    event,
    data, // лише поля, потрібні воркфлоу
    ...(withCallback ? { callbackUrl: `${appBaseUrl}/api/n8n/${event}` } : {}),
  });

  let status: number | null = null;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    status = null;
    try {
      const response = await fetch(`${base}/${event}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": idempotencyKey,
          "x-correlation-id": correlationId,
        },
        body: envelope,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      status = response.status;
      await response.body?.cancel(); // дивимось лише на код статусу
    } catch {
      // мережева помилка або TimeoutError — повторюємо
    }
    console.info(
      `n8n out event=${event} corr=${correlationId} attempt=${attempt} status=${status ?? "network"} ms=${Date.now() - started}`,
    );

    if (status !== null && status >= 200 && status < 300) return { ok: true, status };
    const retryable = status === null || status >= 500; // 5xx, у т.ч. 524
    if (!retryable || attempt > RETRY_DELAYS_MS.length) break;
    await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }
  return { ok: false, status };
}
