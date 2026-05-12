import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

  return NextResponse.json({ url: session.url });
}
