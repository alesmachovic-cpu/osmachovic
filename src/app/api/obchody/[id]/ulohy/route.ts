import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/** GET /api/obchody/[id]/ulohy — zoznam úloh obchodu */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await params;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("obchod_ulohy")
    .select("*")
    .eq("obchod_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ulohy: data ?? [] });
}

/** POST /api/obchody/[id]/ulohy — pridá vlastnú úlohu */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: {
    kategoria?: string;
    nazov: string;
    popis?: string;
    priorita?: string;
    deadline?: string | null;
    drive_link?: string | null;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (!body.nazov) return NextResponse.json({ error: "Chýba nazov" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("obchod_ulohy")
    .insert({
      obchod_id: id,
      kategoria: body.kategoria ?? "akcia",
      nazov:     body.nazov,
      popis:     body.popis ?? null,
      priorita:  body.priorita ?? "normalna",
      deadline:  body.deadline ?? null,
      drive_link: body.drive_link ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ uloha: data }, { status: 201 });
}
