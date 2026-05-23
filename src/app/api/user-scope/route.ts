import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/user-scope
 *
 * Vráti scope prihláseného užívateľa (rola, makler_id, pobocka_ids, isAdmin/isManager)
 * + pre manažéra zoznam makler_ids ktorých záznamy môže editovať (peers v jeho pobočkách).
 *
 * Frontend tento endpoint volá raz pri loade aplikácie cez useUserScope() hook,
 * cachuje výsledok a používa ho na rozhodnutie "canEdit" pre konkrétny record.
 *
 * Pre admin/majiteľ: peers_makler_ids = null (vidí všetkých)
 * Pre manazer: peers_makler_ids = [makler_id1, makler_id2, ...] (z jeho pobočiek)
 * Pre makler: peers_makler_ids = [vlastné makler_id] alebo []
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const scope = await getUserScope(auth.user.id);
  if (!scope) {
    return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  }

  let peers_makler_ids: string[] | null = null; // null = vidí všetkých (admin/majiteľ)
  if (!scope.isAdmin) {
    const sb = getSupabaseAdmin();
    if (scope.role === "manazer" && scope.pobocka_ids.length > 0) {
      const { data: peers } = await sb
        .from("users")
        .select("makler_id")
        .in("pobocka_id", scope.pobocka_ids)
        .not("makler_id", "is", null);
      peers_makler_ids = (peers || []).map(p => String(p.makler_id));
    } else {
      peers_makler_ids = scope.makler_id ? [scope.makler_id] : [];
    }
  }

  return NextResponse.json({
    user_id: scope.user_id,
    role: scope.role,
    makler_id: scope.makler_id,
    pobocka_id: scope.pobocka_id,
    pobocka_ids: scope.pobocka_ids,
    company_id: scope.company_id,
    isAdmin: scope.isAdmin,
    isManager: scope.isManager,
    peers_makler_ids,
  });
}
