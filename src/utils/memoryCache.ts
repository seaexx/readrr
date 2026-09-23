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
