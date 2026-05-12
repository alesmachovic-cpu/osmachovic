// Tento súbor je bezpečný pre import v client komponentoch — neobsahuje Stripe SDK.

export const PLANS = {
  starter: {
    name: "Starter",
    amount: 2900,
    currency: "eur",
    features: ["5 makléri", "Klienti & Portfólio", "Faktúry", "Obhliadky"],
  },
  pro: {
    name: "Pro",
    amount: 5900,
    currency: "eur",
    features: ["Neobmedzení makléri", "Monitor & Analýzy", "AI Copywriter", "Priority podpora"],
  },
} as const;

export type PlanKey = keyof typeof PLANS;
