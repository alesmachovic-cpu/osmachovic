import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Zaloguje zlyhanie AI parsovania dokumentu do review fronty (#4).
 * Best-effort — nikdy nehádže (logovanie nesmie zhodiť samotnú odpoveď).
 * Slúži na to, aby sme v produkcii videli KTORÉ dokumenty AI nezvládlo
 * a vedeli doladiť prompt / model.
 */
export async function logParseFailure(info: {
  source: "parse-doc" | "parse-lv" | "parse-pdf";
  error: string;
  filename?: string | null;
  doc_type?: string | null;
  klient_id?: string | null;
  company_id?: string | null;
  actor_id?: string | null;
}): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("parse_failures").insert({
      source: info.source,
      error: (info.error || "").slice(0, 1000),
      filename: info.filename ?? null,
      doc_type: info.doc_type ?? null,
      klient_id: info.klient_id ?? null,
      company_id: info.company_id ?? null,
      actor_id: info.actor_id ?? null,
    });
  } catch (e) {
    console.error("[parseFailure] log zlyhal:", e);
  }
}
