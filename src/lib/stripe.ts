import StripeLib from "stripe";

// Server-only — nikdy neimportovať v client komponentoch
if (typeof window !== "undefined") {
  throw new Error("src/lib/stripe.ts smie byť importovaný len server-side");
}

let _stripe: InstanceType<typeof StripeLib> | null = null;

export function getStripe(): InstanceType<typeof StripeLib> {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY nie je nastavený");
    _stripe = new StripeLib(key, { apiVersion: "2026-04-22.dahlia" });
  }
  return _stripe;
}

export { PLANS, type PlanKey } from "@/lib/stripe-plans";

// Price IDs — len server-side
export const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID ?? "",
  pro: process.env.STRIPE_PRO_PRICE_ID ?? "",
};
