import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type FirmaInfo = {
  nazov: string;
  sidlo: string;
  ico: string;
  dic: string;
  ic_dph: string;
  registracia: string;
  konatel: string;
  telefon: string;
  email: string;
  web: string;
  prevadzkarena: string;
  region: string;
  historia: string;
  cislo_licencie: string;
  poistovna: string;
  narks: string;
};

export const DEFAULT_FIRMA: FirmaInfo = {
  nazov: "Vianema s. r. o.",
  sidlo: "Karpatské námestie 10A, 831 06 Bratislava — mestská časť Rača",
  ico: "47395095",
  dic: "2023848508",
  ic_dph: "SK2023848508",
  registracia: "Mestského súdu Bratislava III, oddiel Sro, vložka č. 123596/B",
  konatel: "Aleš Machovič",
  telefon: "",
  email: "info@vianema.sk",
  web: "vianema.sk",
  prevadzkarena: "",
  region: "",
  historia: "",
  cislo_licencie: "",
  poistovna: "",
  narks: "",
};

export async function getFirmaInfo(): Promise<FirmaInfo> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("firma_info").select("*").eq("id", 1).maybeSingle();
    if (data) return { ...DEFAULT_FIRMA, ...data };
  } catch { /* fallback */ }
  return DEFAULT_FIRMA;
}
