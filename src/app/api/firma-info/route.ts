import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

const FIELDS = [
  "nazov", "sidlo", "ico", "dic", "ic_dph", "registracia", "konatel",
  "telefon", "email", "web", "prevadzkarena", "region",
  "historia", "cislo_licencie", "poistovna", "narks",
] as const;

function pickFields(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS) {
    if (k in input) out[k] = input[k];
  }
  return out;
}

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("firma_info").select("*").eq("id", 1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || {});
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role))
    return NextResponse.json({ error: "Len admin môže meniť firemné údaje" }, { status: 403 });

  const body = await req.json() as Record<string, unknown>;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("firma_info")
    .upsert({ id: 1, ...pickFields(body), updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
