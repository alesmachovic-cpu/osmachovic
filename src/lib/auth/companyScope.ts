/**
 * companyScope — helper pre multi-tenant query filtering.
 *
 * Použitie v API route:
 *   const auth = await requireUser(req, { strict: true });
 *   if (auth.error) return auth.error;
 *
 *   const q = sb.from("klienti").select("*");
 *   applyCompanyFilter(q, auth.user.company_id);
 *
 * Fallback pre users bez company_id (pred migráciou 061):
 *   fallback na Vianema UUID.
 */

export const VIANEMA_COMPANY_ID = "a0000000-0000-0000-0000-000000000001";

/** Vráti company_id alebo Vianema fallback ak nie je nastavené. */
export function resolveCompanyId(companyId: string | null | undefined): string {
  return companyId || VIANEMA_COMPANY_ID;
}
