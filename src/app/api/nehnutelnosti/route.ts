import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope } from "@/lib/scope";

export const runtime = "nodejs";

const VALID_STATUSES = ["aktivny", "koncept", "predany", "archivovany", "pripravujeme"] as const;

/** PATCH /api/nehnutelnosti?id=<uuid>  body: { user_id, status } */
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const { user_id, status } = body as { user_id?: string; status?: string };

  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: "neplatný status" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Ownership check: buď admin/majitel, alebo vlastník záznamu
  if (user_id) {
    const scope = await getUserScope(user_id);
    if (scope && !scope.isAdmin) {
      const { data: rec } = await sb.from("nehnutelnosti").select("makler_id").eq("id", id).single();
      if (rec && rec.makler_id && rec.makler_id !== scope.makler_id) {
        return NextResponse.json({ error: "Nemáš právo meniť túto nehnuteľnosť" }, { status: 403 });
      }
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

  if (user_id) {
    const scope = await getUserScope(user_id);
    if (scope && !scope.isAdmin) {
      return NextResponse.json({ error: "Mazanie nehnuteľností je len pre admina" }, { status: 403 });
    }
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("nehnutelnosti").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
