import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getStripe, PRICE_IDS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/stripe-plans";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/billing/checkout
 * Body: { plan: "starter" | "pro" }
 *
 * Vytvorí Stripe Checkout session pre predplatné.
 * Vráti { url } na ktorú treba presmerovať používateľa.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const { plan } = await req.json() as { plan: PlanKey };
  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: "Neplatný plán" }, { status: 400 });
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json({ error: "Stripe price ID nie je nakonfigurovaný" }, { status: 500 });
  }

  const sb = getSupabaseAdmin();
  const { data: company } = await sb
    .from("companies")
    .select("id, name, email, stripe_customer_id")
    .eq("id", auth.user.company_id)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Firma nenájdená" }, { status: 404 });
  }

  const stripe = getStripe();

  // Nájdi alebo vytvor Stripe Customer
  let customerId = company.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: company.name as string,
      email: (company.email as string | null) ?? undefined,
      metadata: { company_id: String(company.id) },
    });
    customerId = customer.id;
    await sb.from("companies").update({ stripe_customer_id: customerId }).eq("id", company.id);
  }

  const origin = req.headers.get("origin") || "https://vianema.amgd.sk";
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/nastavenia?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/nastavenia?tab=billing&canceled=1`,
    metadata: { company_id: String(company.id), plan },
    subscription_data: {
      metadata: { company_id: String(company.id), plan },
      trial_period_days: 14,
    },
    allow_promotion_codes: true,
    locale: "sk",
  });

  return NextResponse.json({ url: session.url });
}
