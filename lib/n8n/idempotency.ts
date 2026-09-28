import "server-only";

// DEMO store: process memory. In a real project use a DB/KV table with a UNIQUE constraint:
// serverless instances do not share memory between requests.
const globalForKeys = globalThis as unknown as { n8nCallbackKeys?: Set<string> };
const keys = (globalForKeys.n8nCallbackKeys ??= new Set<string>());

/** true if the key was free and is now claimed; false if it was already processed. */
export async function claimIdempotencyKey(key: string): Promise<boolean> {
  if (keys.has(key)) return false;
  keys.add(key);
  return true;
}

/** Free the key when processing failed after the claim, so the n8n retry is not lost. */
export async function releaseIdempotencyKey(key: string): Promise<void> {
  keys.delete(key);
}
