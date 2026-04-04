/**
 * Per-user localStorage helper.
 * All settings keys are prefixed with the user ID so each makler has their own profile.
 */

export function userKey(userId: string, key: string): string {
  return `${key}__${userId}`;
}

export function getUserItem(userId: string, key: string): string | null {
  if (typeof window === "undefined") return null;
  const perUser = localStorage.getItem(userKey(userId, key));
  if (perUser !== null) return perUser;
  // Only fall back to legacy global key for admin (ales) — the original user
  if (userId === "ales") return localStorage.getItem(key);
  return null;
}

export function setUserItem(userId: string, key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(userKey(userId, key), value);
}
