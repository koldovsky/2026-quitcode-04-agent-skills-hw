import "server-only";
import { db } from "@/lib/db";

// Демо / in-memory база проєкту: Set на рівні модуля годиться лише для демо — на
// serverless обробники не ділять пам'ять між запитами. Прод: таблиця чи KV з унікальним
// обмеженням (INSERT … ON CONFLICT DO NOTHING / SET NX).
const globalForKeys = globalThis as unknown as { n8nSeenIdempotencyKeys?: Set<string> };
const seenKeys = (globalForKeys.n8nSeenIdempotencyKeys ??= new Set<string>());

export function claimIdempotencyKey(key: string): boolean {
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  return true;
}

export function releaseIdempotencyKey(key: string): void {
  seenKeys.delete(key);
}

type CallbackData = {
  jobId: string;
  status: "completed" | "failed";
  requestIdempotencyKey?: string;
  result?: { documentUrl?: string };
  error?: { code?: string };
  completedAt?: string;
};

// Повертає id внутрішнього запису (для revalidatePath), або null, якщо не знайдено.
export async function saveJobResult(event: string, data: CallbackData): Promise<string | null> {
  if (event !== "quote-request" || !data.requestIdempotencyKey) return null;
  return db.saveQuoteJobResult(data.requestIdempotencyKey, {
    jobId: data.jobId,
    status: data.status,
    documentUrl: data.result?.documentUrl ?? null,
    errorCode: data.error?.code ?? null,
    completedAt: data.completedAt ?? new Date().toISOString(),
  });
}
