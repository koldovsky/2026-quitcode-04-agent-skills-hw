import "server-only";

// Demo store, like lib/db.ts: fine for one local process. In production use a DB/KV table with a
// UNIQUE key (claim = insert that fails on a duplicate, release = delete) — serverless instances
// do not share memory.
const globalForKeys = globalThis as unknown as { leadDeskCallbackKeys?: Set<string> };
const claimed = (globalForKeys.leadDeskCallbackKeys ??= new Set<string>());

/** Returns false if the key was already claimed (a duplicate callback). */
export async function claimKey(key: string): Promise<boolean> {
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}

export async function releaseKey(key: string): Promise<void> {
  claimed.delete(key);
}
