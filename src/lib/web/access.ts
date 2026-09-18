/**
 * Oprávnenia k webom.
 *  - manažér / majiteľ / super_admin: všetko (všetky weby, nastavenia, dopyty)
 *  - maklér: iba web, ktorý má priradený (web_sites.user_id = users.id)
 */
export const MANAGER_ROLES = ["super_admin", "majitel", "manazer"];

export function isManager(role: string | null | undefined): boolean {
  return !!role && MANAGER_ROLES.includes(role);
}

export function canEditSite(user: { id: string; role: string }, site: { user_id: string | null }): boolean {
  return isManager(user.role) || (!!site.user_id && site.user_id === user.id);
}
