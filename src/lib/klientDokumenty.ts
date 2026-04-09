import { supabase } from "./supabase";

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

const MAX_BASE64_BYTES = 5 * 1024 * 1024; // 5MB

export async function saveKlientDokument(doc: KlientDokument): Promise<{ id?: string; error?: string }> {
  if (!doc.klient_id) return { error: "klient_id chýba" };
  // Skontroluj duplicitu (rovnaký názov + size pre toho istého klienta)
  try {
    const { data: existing } = await supabase
      .from("klient_dokumenty")
      .select("id")
      .eq("klient_id", doc.klient_id)
      .eq("name", doc.name)
      .eq("size", doc.size ?? 0)
      .maybeSingle();
    if (existing?.id) return { id: existing.id };
  } catch { /* ignore */ }

  const payload: KlientDokument = { ...doc };
  if (payload.data_base64 && payload.data_base64.length > MAX_BASE64_BYTES) {
    delete payload.data_base64;
  }

  const { data, error } = await supabase
    .from("klient_dokumenty")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data?.id };
}

export async function listKlientDokumenty(klientId: string): Promise<KlientDokument[]> {
  const { data, error } = await supabase
    .from("klient_dokumenty")
    .select("*")
    .eq("klient_id", klientId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []) as KlientDokument[];
}

export async function deleteKlientDokument(id: string): Promise<boolean> {
  const { error } = await supabase.from("klient_dokumenty").delete().eq("id", id);
  return !error;
}
