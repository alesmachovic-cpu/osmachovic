import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/logy — vráti počty záznamov z hlavných tabuliek.
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const tables = ["klienti", "naberove_listy", "objednavky", "nehnutelnosti"];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const { count } = await sb.from(table).select("*", { count: "exact", head: true });
      counts[table] = count ?? 0;
    } catch {
      counts[table] = 0;
    }
  }

  return NextResponse.json(counts);
}
