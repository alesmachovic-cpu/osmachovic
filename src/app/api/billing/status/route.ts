import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/billing/status — aktuálny billing stav firmy
export async function GET(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { data: company } = await sb
    .from("companies")
    .select("plan, is_active, stripe_customer_id, plan_valid_until")
    .eq("id", auth.user.company_id)
    .single();

  if (!company) return NextResponse.json({ error: "Firma nenájdená" }, { status: 404 });

  return NextResponse.json({
    plan: company.plan,
    is_active: company.is_active,
    stripe_customer_id: company.stripe_customer_id,
    plan_valid_until: company.plan_valid_until,
  });
}
