# Шаблони коду (Next.js 16, App Router, TypeScript)

Каркаси, з яких починаємо інтеграцію. Імена функцій сховища (`claimIdempotencyKey`, `saveJobResult`…)
— заглушки: підставте функції бази проєкту. Шаблони проходять `scripts/check-contract.mjs`; якщо
змінюєте їх — запускайте перевірку знову.

## 1. `lib/n8n/client.ts` — єдине місце, звідки йдемо в n8n

```ts
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
```

## 2. `lib/n8n/signature.ts` — перевірка колбека

```ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const CALLBACK_WINDOW_SECONDS = 300;
export const CALLBACK_MAX_BYTES = 64 * 1024;

export function isFreshTimestamp(header: string | null, nowMs = Date.now()): header is string {
  if (!header || !/^\d+$/.test(header)) return false;
  return Math.abs(Math.floor(nowMs / 1000) - Number(header)) <= CALLBACK_WINDOW_SECONDS;
}

export function verifySignature(raw: string, timestamp: string, signatureHeader: string | null): boolean {
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret || !signatureHeader) return false;
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`);
  const given = Buffer.from(signatureHeader);
  // timingSafeEqual кидає виняток на різних довжинах — тому спершу довжина
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

## 3. `app/api/n8n/[event]/route.ts` — ендпоінт колбека (кроки 1–10)

```ts
import { after } from "next/server";
import { CALLBACK_MAX_BYTES, isFreshTimestamp, verifySignature } from "@/lib/n8n/signature";
// Заглушки: реалізуйте в шарі даних проєкту (унікальність ключа — обов'язкова).
import { claimIdempotencyKey, releaseIdempotencyKey, saveJobResult } from "@/lib/n8n/store";

const KNOWN_EVENTS = new Set(["quote-request"]);

type CallbackBody = {
  version: number;
  event: string;
  data: {
    jobId: string;
    status: "completed" | "failed";
    requestIdempotencyKey?: string;
    correlationId?: string;
    result?: { documentUrl?: string };
    error?: { code?: string };
    completedAt?: string;
  };
};

function reply(status: number, payload: Record<string, unknown> = {}) {
  return Response.json(payload, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ event: string }> }) {
  const { event } = await params;
  // 1. Подія й content-type — до читання тіла
  if (!KNOWN_EVENTS.has(event)) return reply(404);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415);

  // 2. Сире тіло — один раз, без request.json()
  const raw = await request.text();
  // 3. Розмір
  if (Buffer.byteLength(raw) > CALLBACK_MAX_BYTES) return reply(413);
  // 4. Вікно часу 300 с
  const timestamp = request.headers.get("x-n8n-timestamp");
  if (!isFreshTimestamp(timestamp)) return reply(401);
  // 5. Підпис: довжина + timingSafeEqual (у verifySignature)
  if (!verifySignature(raw, timestamp, request.headers.get("x-n8n-signature"))) return reply(401);

  // 6. Застовпити idempotency-key
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) return reply(400);
  if (!(await claimIdempotencyKey(idempotencyKey))) return reply(200, { duplicate: true });

  try {
    // 7. Лише тепер розбираємо JSON і звіряємо ключ із підписаним тілом
    const body = JSON.parse(raw) as CallbackBody;
    const okEvent = body.event === `${event}.completed` || body.event === `${event}.failed`;
    if (body.version !== 1 || !okEvent || typeof body.data?.jobId !== "string" ||
        idempotencyKey !== `${body.data.jobId}:${body.event}`) {
      await releaseIdempotencyKey(idempotencyKey);
      return reply(400);
    }

    // 8. Мінімальний стан — до відповіді
    const saved = await saveJobResult(event, body.data);
    if (!saved) {
      await releaseIdempotencyKey(idempotencyKey);
      return reply(404);
    }
    const { jobId, correlationId } = body.data;
    console.info(`n8n in event=${event} job=${jobId} corr=${correlationId ?? "-"} status=202`);

    // 10. Повільне — після відповіді
    after(async () => {
      // напр. лист клієнту / сповіщення команди; помилки ловимо й логуємо без персональних даних
    });

    // 9. Прийнято
    return reply(202, { ok: true });
  } catch {
    await releaseIdempotencyKey(idempotencyKey);
    return reply(500);
  }
}
```

Не додаємо `export const runtime = "edge"` — потрібен `node:crypto`.

## 4. Server Action, що запускає довгий воркфлоу

```ts
"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { triggerWorkflow } from "@/lib/n8n/client";

export async function requestSomething(prevState: State, formData: FormData): Promise<State> {
  // сесія / права / валідація — всередині дії (server-auth-actions); форма — за скілом форм проєкту
  const parsed = parseForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  const idempotencyKey = randomUUID();
  const correlationId = randomUUID();
  const record = await db.insertRequest({ ...parsed.data, status: "queued", idempotencyKey, correlationId });

  after(async () => {
    // server-after-nonblocking: користувач не чекає на n8n
    const result = await triggerWorkflow(
      "quote-request",
      { requestId: record.id, company: parsed.data.company, budget: parsed.data.budget }, // мінімум
      { idempotencyKey, correlationId, withCallback: true },
    );
    if (!result.ok) await db.markRequestFailed(record.id);
  });

  return { status: "ok", id: record.id }; // лише { status, id }
}
```

## 5. `.env.example`

```dotenv
# n8n (server-only; real values live in .env.local and hosting settings)
N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook
N8N_WEBHOOK_TOKEN=change-me-webhook-token
N8N_CALLBACK_SECRET=change-me-callback-secret
APP_BASE_URL=http://127.0.0.1:3000
```
