import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/billing/portal
 *
 * Vytvorí Stripe Customer Portal session.
 * Zákazník tu môže meniť plán, platobné údaje, zrušiť predplatné.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { data: company } = await sb
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", auth.user.company_id)
    .single();

  if (!company?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Zatiaľ nemáš aktívne predplatné" },
      { status: 400 },
    );
  }

  const origin = req.headers.get("origin") || "https://vianema.amgd.sk";
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: String(company.stripe_customer_id),
    return_url: `${origin}/nastavenia?tab=billing`,
  });

  await logAudit({
    action: "billing.portal_opened",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: String(auth.user.company_id),
    target_type: "company",
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return NextResponse.json({ url: session.url });
}
