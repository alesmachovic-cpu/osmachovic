// Cache: user_id -> makler UUID
let cache: Record<string, string> = {};
let loaded = false;

/**
 * Get the makler UUID for a given user.
 *
 * IMPLEMENTÁCIA:
 *   Volá `/api/users` (zaužitý session-authed endpoint vracajúci makler_id
 *   priamo z DB) a `/api/makleri` (public) cez Next.js routy — tie používajú
 *   service role na backende a obídu RLS, ktoré inak na anon SELECT vracia [].
 *
 *   PRED FIXOM: priame supabase volania s anon kľúčom vracali prázdne pole
 *   (RLS na users/makleri nemá `anon` policy), takže cache zostala prázdna a
 *   funkcia vracala null pre VŠETKÝCH ne-admin maklérov. To spôsobovalo že
 *   v náber UI sa nezobrazil žiaden klient (filter `if (!myMaklerUuid) return false`).
 *
 *   Primárny zdroj je `user.makler_id` — denormalizovaný stĺpec v users tabuľke.
 *   Fallback je email/name match na makleri tabuľku (legacy, pre starých
 *   userov bez makler_id).
 */
export async function getMaklerUuid(userId: string): Promise<string | null> {
  if (cache[userId]) return cache[userId];

  if (!loaded) {
    try {
      const [usersRes, maklersRes] = await Promise.all([
        fetch("/api/users", { credentials: "include" }).then(r => r.ok ? r.json() : { users: [] }).catch(() => ({ users: [] })),
        fetch("/api/makleri").then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      const users = (usersRes?.users ?? []) as Array<{ id: string; email?: string | null; login_email?: string | null; name?: string | null; makler_id?: string | null }>;
      const makleri = (Array.isArray(maklersRes) ? maklersRes : []) as Array<{ id: string; email?: string | null; meno?: string | null }>;

      for (const u of users) {
        // Preferovane: makler_id priamo z user DB záznamu (autoritatívne)
        if (u.makler_id) {
          cache[u.id] = u.makler_id;
          continue;
        }
        // Fallback: legacy email/name matching
        const m = makleri.find(mk => mk.email && u.email && mk.email === u.email)
          || makleri.find(mk => mk.email && u.login_email && mk.email === u.login_email)
          || makleri.find(mk => mk.meno && u.name && mk.meno === u.name);
        if (m) cache[u.id] = m.id;
      }
    } catch {
      // Silent fail — leave cache empty, callers handle null
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
