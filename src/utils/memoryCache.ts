// Tiny in-memory cache so screens can render their last-known data instantly
// on revisit instead of flashing empty/zero states while they refetch.
// Cleared on sign-out so one account never sees another account's data.

const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearCache(): void {
  store.clear();
}
