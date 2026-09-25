import "server-only";

// Demo storage: process memory, like lib/db.ts. In production this is a table/KV with a unique
// constraint — serverless instances do not share memory.
const globalForKeys = globalThis as unknown as { leadDeskCallbackKeys?: Set<string> };
const claimed = (globalForKeys.leadDeskCallbackKeys ??= new Set<string>());

/** true = first time we see this key; false = duplicate. */
export function claimKey(key: string): boolean {
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}

export function releaseKey(key: string): void {
  claimed.delete(key);
}
