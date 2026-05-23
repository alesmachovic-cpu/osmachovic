/**
 * Per-user localStorage helper.
 * All settings keys are prefixed with the user ID so each makler has their own profile.
 */

export function userKey(userId: string, key: string): string {
  return `${key}__${userId}`;
}

export function getUserItem(userId: string, key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(userKey(userId, key));
}

export function setUserItem(userId: string, key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(userKey(userId, key), value);
}
