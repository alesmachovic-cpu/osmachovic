import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin, isManagerOrAbove } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!isManagerOrAbove(auth.user.role)) {
    return NextResponse.json({ error: "Len manažér, majiteľ alebo admin má prístup k províziam" }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  let query = sb.from("makler_provizie_pct").select("*").order("meno", { ascending: true });

  // Manažér vidí len maklérov svojej pobočky
  if (auth.user.role === "manazer" && auth.user.pobocka_id) {
    const { data: branchUsers } = await sb
      .from("users")
      .select("id")
      .eq("pobocka_id", auth.user.pobocka_id);
    const ids = (branchUsers ?? []).map((u: { id: string }) => u.id);
    if (ids.length > 0) {
      query = query.in("makler_id", ids);
    } else {
      return NextResponse.json([]);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role)) return NextResponse.json({ error: "Len admin môže meniť provízne nastavenia" }, { status: 403 });

  const body = await req.json();
  if (!body.meno) return NextResponse.json({ error: "meno required" }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("makler_provizie_pct").insert({
    meno: body.meno,
    percento: Number(body.percento) || 0,
    ...(body.makler_id ? { makler_id: body.makler_id } : {}),
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role)) return NextResponse.json({ error: "Len admin môže meniť provízne nastavenia" }, { status: 403 });

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (rest.percento !== undefined) rest.percento = Number(rest.percento);
  const { data, error } = await getSupabaseAdmin().from("makler_provizie_pct").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role)) return NextResponse.json({ error: "Len admin môže meniť provízne nastavenia" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await getSupabaseAdmin().from("makler_provizie_pct").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
