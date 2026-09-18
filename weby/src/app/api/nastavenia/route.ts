import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sb } from "@/lib/db";
import { DEFAULT_NASTAVENIA } from "@/lib/defaults";
import type { Nastavenia } from "@/lib/types";

export const runtime = "nodejs";

/** PUT /api/nastavenia — spoločné texty pobočky (len správca). */
export async function PUT(req: NextRequest) {
  const auth = await requireUser(req, { admin: true });
  if (auth.error) return auth.error;
  let body: Partial<Nastavenia>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const data: Nastavenia = { ...DEFAULT_NASTAVENIA };
  (Object.keys(DEFAULT_NASTAVENIA) as Array<keyof Nastavenia>).forEach(k => { if (typeof body[k] === "string") data[k] = body[k] as string; });
  const { error } = await sb().from("weby_settings").upsert({ id: "default", data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ nastavenia: data });
}
