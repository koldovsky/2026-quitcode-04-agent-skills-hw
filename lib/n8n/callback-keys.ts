import "server-only";

// Demo only: process memory. In production use a DB/KV table with a unique constraint.
const store = globalThis as unknown as { n8nCallbackKeys?: Set<string> };
const keys = (store.n8nCallbackKeys ??= new Set<string>());

export function claimCallbackKey(key: string) {
  if (keys.has(key)) return false;
  keys.add(key);
  return true;
}

export function releaseCallbackKey(key: string) {
  keys.delete(key);
}
