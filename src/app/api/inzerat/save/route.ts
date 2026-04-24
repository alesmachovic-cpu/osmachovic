import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payload, editId } = body as { payload: Record<string, unknown>; editId?: string };

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    if (editId) {
      const r = await admin.from("nehnutelnosti").update(payload).eq("id", editId).select();
      if (r.error) return NextResponse.json({ error: r.error.message, code: r.error.code }, { status: 500 });
      if (!r.data || r.data.length === 0) {
        return NextResponse.json({ error: "Update matched 0 rows — editId nenájdený", code: "NO_MATCH" }, { status: 404 });
      }
      return NextResponse.json({ id: r.data[0].id, data: r.data[0] });
    }

    const r = await admin.from("nehnutelnosti").insert(payload).select();
    if (r.error) return NextResponse.json({ error: r.error.message, code: r.error.code, details: r.error.details }, { status: 500 });
    if (!r.data || r.data.length === 0) {
      return NextResponse.json({ error: "Insert returned 0 rows" }, { status: 500 });
    }
    return NextResponse.json({ id: r.data[0].id, data: r.data[0] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Unknown error" }, { status: 500 });
  }
}
