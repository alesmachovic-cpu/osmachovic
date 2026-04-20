/**
 * Klientské dokumenty — CRUD helpers.
 *
 * Všetky operácie idú cez server-side API /api/klient-dokumenty
 * aby sa dáta (data_base64 PDF/DOCX, text_content LV) pred uložením
 * zašifrovali AES-256-GCM s kľúčom DOC_ENCRYPTION_KEY v env vars.
 * Browser nikdy nemá access k master key.
 */

export type KlientDokument = {
  id?: string;
  klient_id: string;
  name: string;
  type?: string;
  size?: number;
  source?: "naber" | "inzerat" | "rezervacia";
  mime?: string;
  text_content?: string;
  data_base64?: string;
  created_at?: string;
};

export async function saveKlientDokument(doc: KlientDokument): Promise<{ id?: string; error?: string }> {
  if (!doc.klient_id) return { error: "klient_id chýba" };
  try {
    const res = await fetch("/api/klient-dokumenty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    });
    const d = await res.json();
    if (!res.ok) return { error: d.error || "Upload zlyhal" };
    return { id: d.id };
  } catch (e) {
    return { error: String(e).slice(0, 200) };
  }
}

export async function listKlientDokumenty(klientId: string): Promise<KlientDokument[]> {
  if (!klientId) return [];
  try {
    const res = await fetch(`/api/klient-dokumenty?klientId=${encodeURIComponent(klientId)}`);
    if (!res.ok) return [];
    const d = await res.json();
    return (d.dokumenty || []) as KlientDokument[];
  } catch {
    return [];
  }
}

export async function deleteKlientDokument(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/klient-dokumenty?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}
