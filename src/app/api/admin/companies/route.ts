import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/admin/companies — zoznam všetkých firiem
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("companies")
    .select("id, name, slug, plan, is_active, stripe_subscription_id, plan_valid_until, created_at, email")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pridaj počet userov pre každú firmu
  const { data: userCounts } = await sb
    .from("users")
    .select("company_id");

  const counts: Record<string, number> = {};
  (userCounts || []).forEach((u: { company_id: string | null }) => {
    if (u.company_id) counts[u.company_id] = (counts[u.company_id] ?? 0) + 1;
  });

  const companies = (data || []).map(c => ({ ...c, user_count: counts[c.id] ?? 0 }));
  return NextResponse.json({ companies });
}

// PATCH /api/admin/companies — aktualizácia firmy (plán, is_active)
export async function PATCH(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json() as { id?: string; plan?: string; is_active?: boolean };
  if (!body.id) return NextResponse.json({ error: "Chýba id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.plan !== undefined) update.plan = body.plan;
  if (body.is_active !== undefined) update.is_active = body.is_active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nič na aktualizáciu" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("companies").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
