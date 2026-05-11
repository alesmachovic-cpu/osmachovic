import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type AuditAction =
  | "login" | "logout"
  | "klient.view" | "klient.create" | "klient.update" | "klient.delete" | "klient.gdpr_erase" | "klient.gdpr_export"
  | "naberovy_list.create" | "naberovy_list.sign" | "naberovy_list.delete"
  | "faktura.create" | "faktura.delete"
  | "obhliadka.create" | "obhliadka.update" | "obhliadka.delete"
  | "user.create" | "user.update" | "user.delete" | "user.invite"
  | "nehnutelnost.create" | "nehnutelnost.update" | "nehnutelnost.delete";

export async function logAudit(entry: {
  action: AuditAction;
  actor_id: string;
  actor_name?: string;
  target_id?: string;
  target_type?: string;
  target_name?: string;
  ip_address?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getSupabaseAdmin().from("audit_log").insert({
      user_id: entry.actor_id,
      action: entry.action,
      entity_type: entry.target_type,
      entity_id: entry.target_id,
      detail: {
        actor_name: entry.actor_name,
        target_name: entry.target_name,
        ip: entry.ip_address,
        ...entry.metadata,
      },
      ip: entry.ip_address,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[audit] Failed to log:", e);
  }
}
