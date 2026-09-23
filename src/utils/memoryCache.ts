// Tiny in-memory cache so screens can render their last-known data instantly
// on revisit instead of flashing empty/zero states while they refetch.
// Cleared on sign-out so one account never sees another account's data.

import AsyncStorage from '@react-native-async-storage/async-storage';

const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearCache(): void {
  store.clear();
  clearPersisted();
}

// Posts seen in any list (Feed, profiles) are cached individually so opening
// one renders its detail screen instantly while the fresh copy loads.
export function seedPostCache(posts: { id: string; user?: any }[]): void {
  posts.forEach((p) => {
    store.set(`post:${p.id}`, p);
    // The author's name/avatar lets their profile render its header instantly.
    if (p.user?.id && p.user.username) store.set(`userPreview:${p.user.id}`, p.user);
  });
}

export interface UserPreview {
  id: string;
  username: string;
  avatar_url: string | null;
  city?: string | null;
}

export function getUserPreview(userId: string): UserPreview | undefined {
  return store.get(`userPreview:${userId}`) as UserPreview | undefined;
}

export function getCachedPost<T>(postId: string): T | undefined {
  return store.get(`post:${postId}`) as T | undefined;
}

// ---- Disk-backed entries (survive app restarts) ----
// Used for the first page of the Feed so a cold open paints last session's
// feed instantly while fresh data loads. Keys are prefixed and wiped on sign-out.
const DISK_PREFIX = 'rcache:';

export async function getPersisted<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(DISK_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function setPersisted<T>(key: string, value: T): void {
  AsyncStorage.setItem(DISK_PREFIX + key, JSON.stringify(value)).catch(() => {});
}

export async function clearPersisted(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(DISK_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {}
}
