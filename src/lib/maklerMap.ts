import { supabase } from "@/lib/supabase";

// Cache: user_id -> makler UUID
let cache: Record<string, string> = {};
let loaded = false;

/**
 * Get the makler UUID from the makleri table for a given user.
 * Matches by email (users.email -> makleri.email).
 */
export async function getMaklerUuid(userId: string): Promise<string | null> {
  if (cache[userId]) return cache[userId];

  if (!loaded) {
    // Load all users and makleri, build mapping
    const [{ data: users }, { data: makleri }] = await Promise.all([
      supabase.from("users").select("id, email, login_email, name"),
      supabase.from("makleri").select("id, email, meno"),
    ]);

    if (users && makleri) {
      for (const u of users) {
        const m = makleri.find(m => m.email && u.email && m.email === u.email)
          || makleri.find(m => m.email && u.login_email && m.email === u.login_email)
          || makleri.find(m => m.meno && u.name && m.meno === u.name);
        if (m) cache[u.id] = m.id;
      }
    }
    loaded = true;
  }

  return cache[userId] || null;
}

/**
 * Get user ID from makler UUID (reverse lookup)
 */
export async function getUserIdFromMaklerUuid(maklerUuid: string): Promise<string | null> {
  if (!loaded) await getMaklerUuid(""); // force load cache

  for (const [userId, uuid] of Object.entries(cache)) {
    if (uuid === maklerUuid) return userId;
  }
  return null;
}

/**
 * Get all makler entries for admin filtering
 */
export async function getAllMakleri(): Promise<{ id: string; meno: string; userId: string }[]> {
  if (!loaded) await getMaklerUuid(""); // force load cache

  return Object.entries(cache).map(([userId, uuid]) => ({
    id: uuid,
    meno: "", // will be filled from cache
    userId,
  }));
}

/** Reset cache (e.g. when new user added) */
export function resetMaklerCache() {
  cache = {};
  loaded = false;
}
