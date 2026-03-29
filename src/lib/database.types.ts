/* ── Typy pre Supabase tabuľky ── */

export type TypNehnutelnosti = string; // Dynamic - all Vianema categories
export type StavNehnutelnosti = "novostavba" | "rekonstruovana" | "povodny_stav";
export type KlientStatus = "novy" | "novy_kontakt" | "aktivny" | "dohodnuty_naber" | "nabrany" | "pasivny" | "volat_neskor" | "nedovolal" | "nechce_rk" | "uz_predal" | "realitna_kancelaria" | "uzavrety" | "caka_na_schvalenie";

export type TypInzercie = "inkognito" | "online_web" | "online" | "vyhradne";

export interface Nehnutelnost {
  id: string;
  nazov: string;
  typ: TypNehnutelnosti;
  lokalita: string;
  cena: number;
  plocha: number | null;
  izby: number | null;
  poschodie: number | null;
  stav: StavNehnutelnosti | null;
  popis: string | null;
  intro: string | null;
  text_popis: string | null;
  url_inzercia: string | null;
  zobrazovat_cenu: boolean;
  zobrazovat_mapu: boolean;
  zobrazovat_hypoteku: boolean;
  so_zmluvou: boolean;
  projekt: boolean;
  specialne_oznacenie: string | null;
  seo_keywords: string | null;
  stat: string;
  kraj: string | null;
  okres: string | null;
  obec: string | null;
  ulica_privatna: string | null;
  makler: string | null;
  interne_id: string | null;
  provizia_hodnota: number | null;
  provizia_typ: string;
  poznamka_interna: string | null;
  orientacia: string | null;
  pripojenie: Record<string, boolean>;
  typ_ceny: string | null;
  tagy: string | null;
  vlastnictvo: string | null;
  text_k_cene: string | null;
  cena_za_energie: string | null;
  exkluzivne: boolean;
  url_virtualka: string | null;
  vhodne_pre_studentov: boolean;
  video_url: string | null;
  kategoria: string | null;
  export_portaly: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface Klient {
  id: string;
  meno: string;
  telefon: string | null;
  email: string | null;
  lokalita: string | null;
  typ: "kupujuci" | "predavajuci" | "oboje";
  status: KlientStatus;
  makler_id: string | null;
  priorita: string | null;
  zdroj: string | null;
  datum_kontaktu: string | null;
  poznamka: string | null;
  proviziaeur: number | null;
  rozpocet_max: number | null;
  datum_naberu: string | null;
  calendar_event_id: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<KlientStatus, string> = {
  novy: "Nový",
  novy_kontakt: "Nový kontakt",
  aktivny: "Aktívny",
  dohodnuty_naber: "Dohodnutý náber",
  nabrany: "Nabraný",
  pasivny: "Pasívny",
  volat_neskor: "Volať neskôr",
  nedovolal: "Nedovolal",
  nechce_rk: "Nechce RK",
  uz_predal: "Už predal",
  realitna_kancelaria: "Realitná kancelária",
  uzavrety: "Uzavretý",
  caka_na_schvalenie: "Čaká na schválenie",
};

export const KRAJE = [
  "Bratislavský kraj",
  "Trnavský kraj",
  "Trenčínsky kraj",
  "Nitriansky kraj",
  "Žilinský kraj",
  "Banskobystrický kraj",
  "Prešovský kraj",
  "Košický kraj",
];
