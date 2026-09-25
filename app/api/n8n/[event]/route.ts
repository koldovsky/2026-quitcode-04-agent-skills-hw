import { revalidatePath } from "next/cache";
import { CALLBACK_MAX_BYTES, isFreshTimestamp, verifySignature } from "@/lib/n8n/signature";
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
  if (!claimIdempotencyKey(idempotencyKey)) return reply(200, { duplicate: true });

  try {
    // 7. Лише тепер розбираємо JSON і звіряємо ключ із підписаним тілом
    const body = JSON.parse(raw) as CallbackBody;
    const okEvent = body.event === `${event}.completed` || body.event === `${event}.failed`;
    if (
      body.version !== 1 ||
      !okEvent ||
      typeof body.data?.jobId !== "string" ||
      idempotencyKey !== `${body.data.jobId}:${body.event}`
    ) {
      releaseIdempotencyKey(idempotencyKey);
      return reply(400);
    }

    // 8. Мінімальний стан — до відповіді
    const requestId = await saveJobResult(event, body.data);
    if (!requestId) {
      releaseIdempotencyKey(idempotencyKey);
      return reply(404);
    }
    revalidatePath(`/quotes/${requestId}`);

    const { jobId, correlationId } = body.data;
    console.info(`n8n in event=${event} job=${jobId} corr=${correlationId ?? "-"} status=202`);

    // 9. Прийнято
    return reply(202, { ok: true });
  } catch {
    releaseIdempotencyKey(idempotencyKey);
    return reply(500);
  }
}
