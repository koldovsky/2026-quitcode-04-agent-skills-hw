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
