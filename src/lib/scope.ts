import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type Role = "super_admin" | "majitel" | "manazer" | "makler";

export interface UserScope {
  user_id: string;
  role: Role;
  makler_id: string | null;
  pobocka_id: string | null;
  company_id: string;
  isAdmin: boolean;
  isManager: boolean;
}

const adminCache = new Map<string, { scope: UserScope | null; expires: number }>();
const TTL_MS = 30_000;

export async function getUserScope(userId: string | null | undefined): Promise<UserScope | null> {
  if (!userId) return null;
  const now = Date.now();
  const cached = adminCache.get(userId);
  if (cached && cached.expires > now) return cached.scope;

  const sb = getSupabaseAdmin();
  const { data: u } = await sb
    .from("users")
    .select("id, role, makler_id, pobocka_id, company_id")
    .eq("id", userId)
    .single();
  if (!u) {
    adminCache.set(userId, { scope: null, expires: now + TTL_MS });
    return null;
  }
  const role = (u.role || "makler") as Role;
  const scope: UserScope = {
    user_id: u.id,
    role,
    makler_id: (u.makler_id as string | null) ?? null,
    pobocka_id: (u.pobocka_id as string | null) ?? null,
    company_id: (u.company_id as string | null) ?? "a0000000-0000-0000-0000-000000000001",
    isAdmin: role === "super_admin" || role === "majitel",
    isManager: role === "super_admin" || role === "majitel" || role === "manazer",
  };
  adminCache.set(userId, { scope, expires: now + TTL_MS });
  return scope;
}

/**
 * Vlastnícky check pre záznam s makler_id (klient, nehnuteľnosť, obhliadka,
 * náberový list). Prístup povolený keď:
 *   - admin/majiteľ — vždy
 *   - vlastník (record.makler_id === scope.makler_id) — vždy
 *   - manažér — len ak vlastník je z tej istej pobočky
 *
 * Pre manažéra robíme dodatočný DB lookup na users.pobocka_id vlastníka.
 */
export async function canEditRecord(
  scope: UserScope | null,
  recordMaklerId: string | null | undefined,
): Promise<boolean> {
  if (!scope) return false;
  if (scope.isAdmin) return true;
  if (recordMaklerId && scope.makler_id && recordMaklerId === scope.makler_id) return true;
  if (scope.role === "manazer" && recordMaklerId && scope.pobocka_id) {
    const sb = getSupabaseAdmin();
    const { data: ownerUser } = await sb
      .from("users")
      .select("pobocka_id")
      .eq("makler_id", recordMaklerId)
      .single();
    return (ownerUser?.pobocka_id ?? null) === scope.pobocka_id;
  }
  return false;
}

/**
 * Náberový list je po podpise (podpis_data je vyplnené) uzamknutý — nedá sa
 * editovať ani vlastníkom, ani admin (len delete pre admin v krajnom prípade).
 * Frontend má volať canEditNaber(scope, naber) namiesto canEditRecord priamo.
 */
export async function canEditNaber(
  scope: UserScope | null,
  naber: { makler_id?: string | null; podpis_data?: string | null } | null | undefined,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!naber) return { allowed: false, reason: "Naber neexistuje" };
  if (naber.podpis_data && String(naber.podpis_data).length > 0) {
    return { allowed: false, reason: "Náberový list je podpísaný a uzamknutý" };
  }
  const ok = await canEditRecord(scope, naber.makler_id);
  return ok ? { allowed: true } : { allowed: false, reason: "Nemáš oprávnenie editovať tento náberový list" };
}

/**
 * Read scope — pre listovacie endpointy. Vracia filter {makler_ids?} ktorý
 * treba aplikovať na query. null = vidí všetko (admin/majiteľ/manažér celého
 * podniku). Pre manažéra vráti makler_ids z jeho pobočky.
 */
export async function getReadFilter(scope: UserScope | null): Promise<{ makler_ids: string[] | null }> {
  if (!scope) return { makler_ids: [] };
  if (scope.isAdmin) return { makler_ids: null };
  if (scope.role === "manazer" && scope.pobocka_id) {
    const sb = getSupabaseAdmin();
    const { data: peers } = await sb
      .from("users")
      .select("makler_id")
      .eq("pobocka_id", scope.pobocka_id)
      .not("makler_id", "is", null);
    return { makler_ids: (peers || []).map(p => String(p.makler_id)) };
  }
  // Bežný maklér — len vlastné záznamy.
  // POZN.: Pre čítanie klientov / portfólia Aleš povedal že je spoločné — to
  // znamená že caller ignoruje tento filter pre tabuľky kde je read open.
  // Tento helper sa použije len kde je read tiež obmedzené (faktúry, odberatelia).
  return { makler_ids: scope.makler_id ? [scope.makler_id] : [] };
}
