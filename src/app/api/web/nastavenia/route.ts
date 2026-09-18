import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { DEFAULT_NASTAVENIA } from "@/lib/web/defaults";
import type { Nastavenia } from "@/lib/web/types";

export const runtime = "nodejs";

/** PUT /api/web/nastavenia — spoločné texty pobočky (len manažér). */
export async function PUT(req: NextRequest) {
  const auth = await requireUser(req, { requireRole: ["super_admin", "majitel", "manazer"] });
  if (auth.error) return auth.error;

  let body: Partial<Nastavenia>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const data: Nastavenia = { ...DEFAULT_NASTAVENIA };
  (Object.keys(DEFAULT_NASTAVENIA) as Array<keyof Nastavenia>).forEach(k => {
    if (typeof body[k] === "string") data[k] = body[k] as string;
  });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("web_nastavenia").upsert({ id: "default", data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ nastavenia: data });
}
