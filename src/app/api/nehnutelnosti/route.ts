import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const VALID_STATUSES = ["aktivny", "koncept", "predany", "archivovany", "pripravujeme"] as const;

/**
 * GET /api/nehnutelnosti
 *   ?id=<uuid>        → single záznam
 *   ?klient_id=<uuid> → všetky pre klienta
 *   (nič)             → všetky (pre portfolio, matching)
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const id = req.nextUrl.searchParams.get("id");
  const klientId = req.nextUrl.searchParams.get("klient_id");
  if (id) {
    const { data, error } = await sb.from("nehnutelnosti").select("*").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ nehnutelnost: data });
  }
  let q = sb.from("nehnutelnosti").select("*").order("created_at", { ascending: false });
  if (klientId) q = q.eq("klient_id", klientId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** PATCH /api/nehnutelnosti?id=<uuid>  body: { user_id, status } */
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const { user_id, status } = body as { user_id?: string; status?: string };

  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: "neplatný status" }, { status: 400 });
  }

  if (!user_id) return NextResponse.json({ error: "Vyžaduje prihlásenie" }, { status: 401 });

  const sb = getSupabaseAdmin();

  // Ownership check: buď admin/majitel, alebo vlastník záznamu
  const scope = await getUserScope(user_id);
  if (scope && !scope.isAdmin) {
    const { data: rec } = await sb.from("nehnutelnosti").select("makler_id").eq("id", id).single();
    if (rec && rec.makler_id && rec.makler_id !== scope.makler_id) {
      return NextResponse.json({ error: "Nemáš právo meniť túto nehnuteľnosť" }, { status: 403 });
    }
  }

  const { error } = await sb.from("nehnutelnosti").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/nehnutelnosti?id=<uuid>  body: { user_id } — len admin */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { user_id } = body as { user_id?: string };

  if (!user_id) return NextResponse.json({ error: "Vyžaduje prihlásenie" }, { status: 401 });

  const scope = await getUserScope(user_id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Mazanie nehnuteľností je len pre admina" }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("nehnutelnosti").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ action: "nehnutelnost.delete", actor_id: user_id, target_id: id, target_type: "nehnutelnost", ip_address: req.headers.get("x-forwarded-for") || undefined });
  return NextResponse.json({ ok: true });
}
