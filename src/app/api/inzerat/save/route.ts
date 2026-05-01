import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope, canEditRecord } from "@/lib/scope";

export const runtime = "nodejs";

/**
 * POST /api/inzerat/save
 * Body: { user_id, payload, editId? }
 *
 * - editId: update existing nehnuteľnosť. Vyžaduje vlastníctvo (canEditRecord).
 * - bez editId: insert. makler_id sa odvodí zo scope (admin môže prepísať).
 *
 * user_id je odporúčaný (default scope = makler), ale pre spätnú kompatibilitu
 * staré clienti bez user_id stále fungujú v insert móde — vlož sa tak ako
 * payload prikazuje (legacy chovanie). Edit však user_id vyžaduje aby sme
 * mohli verifikovať vlastníctvo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payload, editId, user_id: userId } = body as {
      payload: Record<string, unknown>;
      editId?: string;
      user_id?: string;
    };

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    if (editId) {
      if (!userId) {
        return NextResponse.json({ error: "user_id required pre edit" }, { status: 400 });
      }
      const scope = await getUserScope(userId);
      if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

      const { data: existing } = await admin
        .from("nehnutelnosti")
        .select("id, makler_id")
        .eq("id", editId)
        .single();
      if (!existing) {
        return NextResponse.json({ error: "Inzerát nenájdený", code: "NO_MATCH" }, { status: 404 });
      }
      const allowed = await canEditRecord(scope, existing.makler_id);
      if (!allowed) {
        return NextResponse.json({ error: "Nemáš oprávnenie editovať tento inzerát" }, { status: 403 });
      }
      // makler_id v payload zachovať len pre admin (delegate); inak nedovolíme prepis
      const safePayload = { ...payload };
      if (!scope.isAdmin) delete safePayload.makler_id;

      const r = await admin.from("nehnutelnosti").update(safePayload).eq("id", editId).select();
      if (r.error) return NextResponse.json({ error: r.error.message, code: r.error.code }, { status: 500 });
      if (!r.data || r.data.length === 0) {
        return NextResponse.json({ error: "Update matched 0 rows", code: "NO_MATCH" }, { status: 404 });
      }
      return NextResponse.json({ id: r.data[0].id, data: r.data[0] });
    }

    // INSERT — ak je user_id, vyplň makler_id zo scope (anti-impersonácia)
    const insertPayload: Record<string, unknown> = { ...payload };
    if (userId) {
      const scope = await getUserScope(userId);
      if (scope) {
        if (!scope.isAdmin) {
          // bežný maklér — vlastníctvo zo scope, body sa ignoruje
          if (scope.makler_id) insertPayload.makler_id = scope.makler_id;
        }
      }
    }

    const r = await admin.from("nehnutelnosti").insert(insertPayload).select();
    if (r.error) return NextResponse.json({ error: r.error.message, code: r.error.code, details: r.error.details }, { status: 500 });
    if (!r.data || r.data.length === 0) {
      return NextResponse.json({ error: "Insert returned 0 rows" }, { status: 500 });
    }
    return NextResponse.json({ id: r.data[0].id, data: r.data[0] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Unknown error" }, { status: 500 });
  }
}
