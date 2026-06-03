import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("ulohy").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

const ALLOWED_PRIORITA = ["nizka", "stredna", "vysoka"] as const;

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  // P0 fix 2026-05-24: pre-validuj enum hodnoty, nedaj DB constraint violation = 500.
  if (body.priorita && !ALLOWED_PRIORITA.includes(body.priorita as typeof ALLOWED_PRIORITA[number])) {
    return NextResponse.json({
      error: `Neplatná priorita '${body.priorita}'`,
      allowed: ALLOWED_PRIORITA,
      code: "INVALID_ENUM",
    }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("ulohy").insert(body).select().single();
  if (error) {
    // Catch any check constraint violation we missed
    if (error.code === "23514") {
      return NextResponse.json({ error: `DB constraint: ${error.message}`, code: "INVALID_VALUE" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await req.json();
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("ulohy").update(body).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("ulohy").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
