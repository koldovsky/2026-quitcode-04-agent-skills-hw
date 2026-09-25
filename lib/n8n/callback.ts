import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const CALLBACK_MAX_BYTES = 64 * 1024;
export const CALLBACK_WINDOW_S = 300;

export type CallbackCheck = { ok: true } | { ok: false; status: 401 | 413 | 500 };

/** Steps 3–5 of the callback order. `raw` is the body exactly as received (req.text()). */
export function verifyCallback(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  nowMs = Date.now(),
): CallbackCheck {
  if (Buffer.byteLength(raw, "utf8") > CALLBACK_MAX_BYTES) return { ok: false, status: 413 };
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret) return { ok: false, status: 500 };
  if (!timestamp || !/^\d{1,12}$/.test(timestamp)) return { ok: false, status: 401 };
  if (Math.abs(Math.floor(nowMs / 1000) - Number(timestamp)) > CALLBACK_WINDOW_S) return { ok: false, status: 401 };

  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(signature ?? "");
  // timingSafeEqual throws on different lengths, so compare lengths first.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, status: 401 };
  return { ok: true };
}
