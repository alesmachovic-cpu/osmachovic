// AMGD-only base brand (Tier 3 — used on amgd.sk, sales decks, demos)
export { Logo } from "./Logo";
export { Wordmark } from "./Wordmark";
export { Monogram } from "./Monogram";

// Cobrand — Tier 1 (klient-facing): Vianema dominates, AMGD whispers
//   Use on: login screen, klient PDFs, contracts, email signatures, headers
//   visible to klients.
export { PoweredByAMGD, VianemaBranded } from "./Tier1ClientFacing";

// Cobrand — Tier 2 (partnership): VIANEMA | AMGD as equals with separator
//   Use on: pitch decks for other realitky, case studies, partnership pages,
//   joint webinars. NEVER use in klient-facing contexts.
export { PartnershipLockup } from "./Tier2Partnership";
