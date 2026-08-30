// Minimal in-memory TTL cache for expensive read-heavy GraphQL queries
// (dashboard, analytics). Keyed by an owner-scoped string; invalidated on
// relevant mutations so data stays fresh for live POS usage.

const store = new Map<string, { value: unknown; expires: number }>();

export const CACHE_TTL_MS = Number(process.env.QUERY_CACHE_TTL_MS || 30000);

export async function memoize<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = CACHE_TTL_MS,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value as T;
  }
  const value = await loader();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

// Drop all cached entries for an owner (call after writes that affect the data).
export function invalidateOwner(ownerId: string): void {
  const prefix = `${ownerId}::`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function clearCache(): void {
  store.clear();
}

export function cacheSize(): number {
  return store.size;
}
