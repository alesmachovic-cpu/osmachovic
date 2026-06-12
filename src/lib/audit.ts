import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Audit akcie — známe akcie cez union pre IDE autocomplete, fallback `string`
// dovolí pridať nové bez zmeny typu (gdpr.erasure.*, faktura.soft_delete, …).
export type AuditAction =
  | "login" | "logout"
  | "klient.view" | "klient.create" | "klient.update" | "klient.delete" | "klient.gdpr_erase" | "klient.gdpr_export"
  | "naberovy_list.create" | "naberovy_list.sign" | "naberovy_list.delete"
  | "faktura.create" | "faktura.delete" | "faktura.soft_delete" | "faktura.update"
  | "obhliadka.create" | "obhliadka.update" | "obhliadka.delete"
  | "user.create" | "user.update" | "user.delete" | "user.invite"
  | "nehnutelnost.create" | "nehnutelnost.update" | "nehnutelnost.delete"
  | "gdpr.erasure.started" | "gdpr.erasure.completed" | "gdpr.erasure.partial"
  | "obchod.create" | "obchod.update" | "obchod.delete"
  | "kz.generate" | "kz.aml_blocked"
  | (string & {}); // fallback — povolí nové akcie bez zmeny typu, ale IDE stále autocompletne známe.

export async function logAudit(entry: {
  action: AuditAction;
  actor_id: string;
  actor_name?: string;
  target_id?: string;
  target_type?: string;
  target_name?: string;
  ip_address?: string;
  // Akceptujeme `detail` (nový name) aj `metadata` (legacy) pre spätnú kompatibilitu.
  detail?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  // Vracia true ak sa záznam reálne zapísal, false pri zlyhaní. Volajúci pri
  // MANDATORY audite (napr. GDPR erasure — fail-closed) MUSÍ návratovú hodnotu
  // skontrolovať; bežné akcie ju môžu ignorovať (spätne kompatibilné).
  try {
    const { error } = await getSupabaseAdmin().from("audit_log").insert({
      user_id: entry.actor_id,
      action: entry.action,
      entity_type: entry.target_type,
      entity_id: entry.target_id,
      detail: {
        actor_name: entry.actor_name,
        target_name: entry.target_name,
        ip: entry.ip_address,
        ...entry.metadata,
        ...entry.detail,
      },
      ip: entry.ip_address,
      created_at: new Date().toISOString(),
    });
    if (error) {
      // Supabase insert vracia { error } — NEhádže, preto to predtým ticho prešlo.
      console.error("[audit] Failed to log:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[audit] Failed to log:", e);
    return false;
  }
}
