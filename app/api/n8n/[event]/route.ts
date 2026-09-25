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
