import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const CALLBACK_MAX_BYTES = 64 * 1024;
export const CALLBACK_WINDOW_SECONDS = 300;

export type SignatureCheck = "ok" | "stale" | "invalid";

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
