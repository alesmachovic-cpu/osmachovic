/* ── Typy pre Supabase tabuľky ── */

export type TypNehnutelnosti = string; // Dynamic - all Vianema categories
export type StavNehnutelnosti = "novostavba" | "rekonstruovana" | "povodny_stav";
export type KlientStatus = "novy" | "novy_kontakt" | "aktivny" | "dohodnuty_naber" | "nabrany" | "inzerovany" | "pasivny" | "volat_neskor" | "nedovolal" | "nechce_rk" | "uz_predal" | "uz_kupil" | "realitna_kancelaria" | "uzavrety" | "caka_na_schvalenie" | "caka_na_hypoteku" | "zaujem_o_konkretnu" | "zaujem_konkretna_nasa" | "zaujem_konkretna_ina_rk" | "odlozene" | "nereaguje" | "turista" | "hypo_konzultacia" | "kapacita_schvalena" | "rezervacia" | "podpis_kz";

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
  klient_id: string | null;
  status: "koncept" | "aktivny" | "predany" | "archivovany" | null;
  makler_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Klient {
  id: string;
  meno: string;
  telefon: string | null;
  email: string | null;
  lokalita: string | null;
  typ: "kupujuci" | "predavajuci" | "oboje" | "prenajimatel";
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
  spolupracujuci_makler_id: string | null;
  spolupracujuci_provizia_pct: number | null;
  lv_data: Record<string, unknown> | null;
  anonymized_at: string | null;
  // Voľní klienti / SLA — viď migrácia 026_volni_klienti.sql
  je_volny?: boolean | null;
  volny_at?: string | null;
  volny_dovod?: string | null;
  sla_warning_at?: string | null;
  sla_critical_at?: string | null;
  sla_last_chance_at?: string | null;
  napomenutia_count?: number | null;
  posledne_napomenutie_at?: string | null;
  posledne_napomenutie_dovod?: string | null;
  manager_action_at?: string | null;
  manager_action_type?: string | null;
  updated_at?: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<KlientStatus, string> = {
  novy: "Nový",
  novy_kontakt: "Nový kontakt",
  aktivny: "Aktívny",
  dohodnuty_naber: "Dohodnutý náber",
  nabrany: "Nabraný",
  inzerovany: "Inzerovaný",
  pasivny: "Pasívny",
  volat_neskor: "Volať neskôr",
  nedovolal: "Nedovolal",
  nechce_rk: "Nechce RK",
  uz_predal: "Už predal",
  realitna_kancelaria: "Realitná kancelária",
  uzavrety: "Uzavretý",
  caka_na_schvalenie: "Čaká na schválenie",
  // Nové statusy pre kupujúcich (per Aleš 2026-05-23)
  caka_na_hypoteku: "Čaká na hypotéku",
  zaujem_o_konkretnu: "Záujem o konkrétnu",
  odlozene: "Odložené",
  nereaguje: "Nereaguje",
  uz_kupil: "Už kúpil",
  turista: "Turista",
  zaujem_konkretna_nasa: "Záujem — naša",
  zaujem_konkretna_ina_rk: "Záujem — iná RK",
  // F1 kupujuci pipeline (per Aleš plan-kupujuci 2026-05-23)
  hypo_konzultacia: "Hypo konzultácia",
  kapacita_schvalena: "Kapacita schválená",
  rezervacia: "Rezervácia",
  podpis_kz: "Podpis KZ",
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
