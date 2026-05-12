import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StripeObj = Record<string, unknown>;

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[billing/webhook] STRIPE_WEBHOOK_SECRET nie je nastavený");
    return NextResponse.json({ error: "Webhook nie je nakonfigurovaný" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Chýba stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: { type: string; data: { object: StripeObj } };
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret) as unknown as typeof event;
  } catch (err) {
    console.error("[billing/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Neplatný podpis" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      if (obj.mode !== "subscription") break;
      const meta = obj.metadata as Record<string, string> | null;
      const companyId = meta?.company_id;
      const plan = meta?.plan ?? "starter";
      if (!companyId) break;

      const sub = obj.subscription;
      const subId = typeof sub === "string" ? sub : (sub as StripeObj | null)?.id as string ?? null;

      await sb.from("companies").update({ stripe_subscription_id: subId, plan, is_active: true }).eq("id", companyId);
      console.log(`[billing/webhook] checkout.completed company=${companyId} plan=${plan}`);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const meta = obj.metadata as Record<string, string> | null;
      const companyId = meta?.company_id;
      if (!companyId) break;

      const plan = meta?.plan ?? "starter";
      const status = obj.status as string;
      const isActive = ["active", "trialing"].includes(status);
      const periodEnd = obj.current_period_end as number | null;
      const validUntil = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

      await sb.from("companies").update({
        plan: isActive ? plan : "starter",
        plan_valid_until: validUntil,
        is_active: isActive,
        stripe_subscription_id: obj.id as string,
      }).eq("id", companyId);
      console.log(`[billing/webhook] subscription.${event.type.split(".")[2]} company=${companyId} status=${status}`);
      break;
    }

    case "customer.subscription.deleted": {
      const meta = obj.metadata as Record<string, string> | null;
      const companyId = meta?.company_id;
      if (!companyId) break;

      await sb.from("companies").update({ plan: "starter", plan_valid_until: null, stripe_subscription_id: null }).eq("id", companyId);
      console.log(`[billing/webhook] subscription.deleted company=${companyId}`);
      break;
    }

    case "invoice.payment_failed": {
      const customer = obj.customer;
      const customerId = typeof customer === "string" ? customer : (customer as StripeObj | null)?.id as string ?? null;
      if (!customerId) break;

      await sb.from("companies").update({ is_active: false }).eq("stripe_customer_id", customerId);
      console.warn(`[billing/webhook] payment_failed customer=${customerId}`);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
