import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Označí klienta ako "živý vzťah" — nastaví last_engagement_at = teraz, čím
 * resetuje retention lehotu nečinnosti (F11, viď security-audit/retention-policy.md).
 *
 * Voláme LEN pri reálnom signáli živého vzťahu:
 *  - zalogovaný kontakt klienta (hovor / stretnutie / e-mail / poznámka),
 *  - udelenie marketingového súhlasu,
 *  - nová obhliadka / obchod.
 *
 * NEvoláme pri jednostrannom odoslaní e-mailu z našej strany (to nie je dôkaz
 * živého vzťahu — GDPR by to považoval za obchádzanie minimalizácie).
 *
 * Best-effort — nikdy nehádže (reset lehoty nesmie zhodiť hlavnú operáciu).
 */
export async function touchEngagement(klientId: string | null | undefined): Promise<void> {
  if (!klientId) return;
  try {
    await getSupabaseAdmin()
      .from("klienti")
      .update({ last_engagement_at: new Date().toISOString() })
      .eq("id", klientId);
  } catch (e) {
    console.error("[engagement] touch zlyhal:", e);
  }
}
