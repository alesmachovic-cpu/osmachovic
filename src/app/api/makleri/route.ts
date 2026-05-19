import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * 🚨 FIX 2026-05-20 (P1 cross-tenant leak):
 *   Pôvodne GET vracal makléri všetkých firiem (chýbal auth + company_id filter).
 *   Multi-tenant breach.
 *
 *   Teraz: requireUser + filter na makleri.company_id (po migrácii 074).
 *   platform_admin môže pozrieť cross-tenant cez ?all=1.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const aktivny = searchParams.get("aktivny");
  const wantsAll = searchParams.get("all") === "1";
  const isPlatformAdmin = auth.user.role === "platform_admin";

  let query = sb.from("makleri").select("id, meno, email, telefon, aktivny, company_id").order("meno");
  if (aktivny === "true") query = query.eq("aktivny", true);
  if (!(wantsAll && isPlatformAdmin)) {
    query = query.eq("company_id", auth.user.company_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[makleri] Supabase error:", error.message, "code:", error.code);
    return NextResponse.json([]);
  }
  return NextResponse.json(data ?? []);
}
