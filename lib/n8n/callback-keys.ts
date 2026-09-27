import "server-only";

// Claimed idempotency-keys of n8n callbacks.
// DEMO ONLY: process memory, kept on globalThis because a Next.js 16 build doesn't share
// module-level variables between Route Handlers and pages. In production: a table or KV with a
// UNIQUE constraint on the key; serverless instances don't share memory at all.
const store = globalThis as typeof globalThis & { __n8nCallbackKeys?: Set<string> };
const claimed = (store.__n8nCallbackKeys ??= new Set<string>());

/** true = first time (claimed now); false = a repeat → answer 200 {"duplicate": true}. */
export async function claimCallbackKey(key: string): Promise<boolean> {
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}

/** Processing failed after the claim: free the key so n8n's Retry On Fail is processed again. */
export async function releaseCallbackKey(key: string): Promise<void> {
  claimed.delete(key);
}
