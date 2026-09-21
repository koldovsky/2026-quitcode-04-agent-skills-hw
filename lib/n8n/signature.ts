import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// x-n8n-signature: sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "<x-n8n-timestamp>.<raw body>")>
// computed over the exact bytes n8n sent (skill integrating-n8n-webhooks, references/contract.md).

export const CALLBACK_WINDOW_SECONDS = 300;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no-secret" | "bad-timestamp" | "stale-timestamp" | "bad-signature" };

export function verifyN8nSignature(input: {
  rawBody: Uint8Array;
  timestamp: string | null;
  signature: string | null;
  secret: string | undefined;
}): VerifyResult {
  // An empty key would let anyone compute a valid HMAC: without a secret nothing is accepted.
  if (!input.secret) return { ok: false, reason: "no-secret" };
  const ts = input.timestamp ?? "";
  if (!/^\d{1,12}$/.test(ts)) return { ok: false, reason: "bad-timestamp" };
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > CALLBACK_WINDOW_SECONDS) {
    return { ok: false, reason: "stale-timestamp" };
  }
  const expected = createHmac("sha256", input.secret).update(`${ts}.`).update(input.rawBody).digest();
  const hex = /^sha256=([0-9a-f]{64})$/i.exec(input.signature ?? "")?.[1];
  const given = hex ? Buffer.from(hex, "hex") : Buffer.alloc(0);
  // timingSafeEqual throws on different lengths, so compare the lengths first.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad-signature" };
  return { ok: true };
}
