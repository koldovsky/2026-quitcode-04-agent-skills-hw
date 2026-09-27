import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// n8n → Next.js callbacks: time window, signature, envelope (contract: skill integrating-n8n-webhooks).

export const MAX_CALLBACK_BYTES = 64 * 1024; // a callback carries links, not files
const MAX_CLOCK_SKEW_SECONDS = 300;

export type CallbackData = {
  jobId: string;
  status: "completed" | "failed";
  correlationId?: string;
  requestIdempotencyKey: string;
  result?: Record<string, unknown>;
  error?: { code: string };
  completedAt?: string;
};

export type CallbackEnvelope = { version: 1; event: string; data: CallbackData };

/** x-n8n-timestamp: Unix seconds, at most 300 s away from now in either direction. */
export function isFreshTimestamp(timestamp: string | null): timestamp is string {
  if (!timestamp || !/^\d{1,12}$/.test(timestamp)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) <= MAX_CLOCK_SKEW_SECONDS;
}

/** x-n8n-signature = "sha256=" + hex HMAC-SHA256(N8N_CALLBACK_SECRET, `${timestamp}.${rawBody}`). */
export function verifyCallbackSignature(rawBody: string, timestamp: string, signature: string | null): boolean {
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret || !signature) return false;
  const hmac = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  // Compare the whole "sha256=<hex>" as bytes: lengths first (timingSafeEqual throws on a
  // mismatch), then constant time. Never ===, never Buffer.from(hex, "hex") (it truncates).
  const expected = Buffer.from(`sha256=${hmac}`);
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Parses the body only after the signature check. null = wrong shape or an event this path doesn't take. */
export function parseCallbackEnvelope(raw: string, events: readonly string[]): CallbackEnvelope | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1 || typeof value.event !== "string") return null;
  if (!events.includes(value.event)) return null;
  const data = value.data;
  if (!isRecord(data) || typeof data.jobId !== "string" || !data.jobId) return null;
  if (data.status !== "completed" && data.status !== "failed") return null;
  if (typeof data.requestIdempotencyKey !== "string" || !data.requestIdempotencyKey) return null;
  return { version: 1, event: value.event, data: data as CallbackData };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
