import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const CALLBACK_MAX_BYTES = 64 * 1024;
export const CALLBACK_WINDOW_SECONDS = 300;

export type SignatureCheck = "ok" | "stale" | "invalid";

/**
 * Reads the raw body as text with the limit applied WHILE reading: an unsigned oversized request is
 * never buffered whole (request.text() would load it all before any check). Null = too large.
 */
export async function readBodyLimited(request: Request, maxBytes = CALLBACK_MAX_BYTES): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null; // cheap early exit; the header can lie, the loop below cannot
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Checks x-n8n-timestamp (300 s window) and x-n8n-signature: sha256=HMAC(secret, `${timestamp}.${raw}`). */
export function verifyCallbackSignature(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || !signature) return "invalid";
  if (Math.abs(nowSeconds - Number(timestamp)) > CALLBACK_WINDOW_SECONDS) return "stale";
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) throw new Error("n8n: N8N_CALLBACK_SECRET is not set");
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(signature);
  // timingSafeEqual throws on different lengths — compare lengths first
  return given.length === expected.length && timingSafeEqual(given, expected) ? "ok" : "invalid";
}

// Demo storage for processed callback keys. In production: a unique index in the database —
// process memory is not shared between serverless instances.
const g = globalThis as unknown as { n8nCallbackKeys?: Set<string> };
const keys = (g.n8nCallbackKeys ??= new Set());

/** Returns false if the key was already claimed (a repeated callback). */
export async function claimCallbackKey(key: string) {
  if (keys.has(key)) return false;
  keys.add(key);
  return true;
}

/** Frees the key when processing failed, so n8n's Retry On Fail can deliver the callback again. */
export async function releaseCallbackKey(key: string) {
  keys.delete(key);
}
