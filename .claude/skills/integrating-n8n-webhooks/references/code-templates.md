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

## 2. `lib/n8n/signature.ts` — вікно часу, підпис, тіло з лімітом

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

// Reads the raw body as text, but never more than maxBytes: rejects by content-length first,
// then streams and stops as soon as the limit is exceeded. Returns null when the body is too large.
export async function readBodyLimited(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
```

## 3. `lib/n8n/callback-body.ts` — перевірка форми підписаного тіла (крок 7)

Будь-яка невідповідність — `null`, роут відповідає 400. `CallbackData` — тип зі сховища проєкту
(`jobId`, `status`, `requestIdempotencyKey`, `correlationId?`, `result?`, `error?`, `completedAt?`).

```ts
import "server-only";
import type { CallbackData } from "@/lib/n8n/store";

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Runtime validation of the signed body (step 7). Returns the typed data or null (-> 400).
export function parseCallback(raw: string, pathEvent: string, idempotencyKey: string): { event: string; data: CallbackData } | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(body) || body.version !== 1 || typeof body.event !== "string" || !isRecord(body.data)) return null;

  const suffix = body.event === `${pathEvent}.completed` ? "completed" : body.event === `${pathEvent}.failed` ? "failed" : null;
  const d = body.data;
  if (
    !suffix ||
    d.status !== suffix ||
    !isNonEmptyString(d.jobId) ||
    !isNonEmptyString(d.requestIdempotencyKey) ||
    idempotencyKey !== `${d.jobId}:${body.event}`
  ) {
    return null;
  }
  // A completed job must deliver its document; a failed one may omit result entirely.
  if (suffix === "completed" && !(isRecord(d.result) && isNonEmptyString(d.result.documentUrl))) return null;
  if (d.result !== undefined && !(isRecord(d.result) && (d.result.documentUrl === undefined || typeof d.result.documentUrl === "string"))) return null;
  if (d.error !== undefined && !(isRecord(d.error) && (d.error.code === undefined || typeof d.error.code === "string"))) return null;
  if (d.correlationId !== undefined && typeof d.correlationId !== "string") return null;
  if (d.completedAt !== undefined && typeof d.completedAt !== "string") return null;

  return {
    event: body.event,
    data: {
      jobId: d.jobId,
      status: suffix,
      requestIdempotencyKey: d.requestIdempotencyKey,
      correlationId: d.correlationId as string | undefined,
      result: d.result as CallbackData["result"],
      error: d.error as CallbackData["error"],
      completedAt: d.completedAt as string | undefined,
    },
  };
}
```

## 3a. `app/api/n8n/[event]/route.ts` — ендпоінт колбека (кроки 1–10)

`claimIdempotencyKey` / `releaseIdempotencyKey` / `saveJobResult` — функції сховища проєкту (унікальність ключа
обов'язкова; `saveJobResult` не понижує вже `ready` запис). Повільне (листи, сповіщення) після запису — в
`after()`.

```ts
import { revalidatePath } from "next/cache";
import { CALLBACK_MAX_BYTES, isFreshTimestamp, readBodyLimited, verifySignature } from "@/lib/n8n/signature";
import { parseCallback } from "@/lib/n8n/callback-body";
import { claimIdempotencyKey, releaseIdempotencyKey, saveJobResult } from "@/lib/n8n/store";

const KNOWN_EVENTS = new Set(["quote-request"]);

function reply(status: number, payload: Record<string, unknown> = {}) {
  return Response.json(payload, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ event: string }> }) {
  const { event } = await params;
  // 1. Подія й content-type — до читання тіла
  if (!KNOWN_EVENTS.has(event)) return reply(404);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415);

  // 2–3. Сире тіло одним рядком, але не більше 64 КБ: спершу content-length, далі потік з лімітом
  const raw = await readBodyLimited(request, CALLBACK_MAX_BYTES);
  if (raw === null) return reply(413);
  // 4. Вікно часу 300 с
  const timestamp = request.headers.get("x-n8n-timestamp");
  if (!isFreshTimestamp(timestamp)) return reply(401);
  // 5. Підпис: довжина + timingSafeEqual (у verifySignature)
  if (!verifySignature(raw, timestamp, request.headers.get("x-n8n-signature"))) return reply(401);

  // 6. Застовпити idempotency-key
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) return reply(400);
  if (!claimIdempotencyKey(idempotencyKey)) return reply(200, { duplicate: true });

  // 7. Лише тепер розбираємо JSON і перевіряємо форму; будь-яка невідповідність — 400
  const callback = parseCallback(raw, event, idempotencyKey);
  if (!callback) {
    releaseIdempotencyKey(idempotencyKey);
    return reply(400);
  }

  try {
    // 8. Мінімальний стан — до відповіді
    const requestId = await saveJobResult(event, callback.data);
    if (!requestId) {
      releaseIdempotencyKey(idempotencyKey);
      return reply(404);
    }
    revalidatePath(`/quotes/${requestId}`);
    console.info(`n8n in event=${callback.event} job=${callback.data.jobId} corr=${callback.data.correlationId ?? "-"} status=202`);

    // 9. Прийнято
    return reply(202, { ok: true });
  } catch {
    releaseIdempotencyKey(idempotencyKey);
    return reply(500);
  }
}
```

Не додаємо `export const runtime = "edge"` — потрібен `node:crypto`. `request.text()` не використовуємо: воно
читає тіло без ліміту ще до перевірки розміру.

## 4. Server Action, що запускає довгий воркфлоу

```ts
"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
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
    try {
      const result = await triggerWorkflow(
        "quote-request",
        { requestId: record.id, company: parsed.data.company, budget: parsed.data.budget }, // мінімум
        { idempotencyKey, correlationId, withCallback: true },
      );
      if (!result.ok) await db.markRequestFailed(record.id);
    } catch {
      // напр. не задані змінні N8N_* — запис не має зависнути в "queued"
      console.error(`n8n quote-request not started for request ${record.id}`);
      await db.markRequestFailed(record.id);
    }
  });

  // На сторінку статусу — redirect() з дії (не router.push на клієнті): так форма працює й без JavaScript.
  redirect(`/quotes/${record.id}`);
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
