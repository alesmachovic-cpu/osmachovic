export type TypNehnutelnosti = "byt" | "dom" | "pozemok";
export type Priorita = "vysoka" | "stredna" | "nizka";
export type StavNehnutelnosti = "nova" | "rekonstruovana" | "povodny_stav" | "novostavba";
export type StatusKlienta =
  | "novy_kontakt"
  | "dohodnuty_naber"
  | "volat_neskor"
  | "nedovolal"
  | "nechce_rk"
  | "uz_predal"
  | "realna_kancelaria";

export const STATUS_LABELS: Record<StatusKlienta, string> = {
  novy_kontakt:      "Nový kontakt",
  dohodnuty_naber:   "Dohodnutý naber",
  volat_neskor:      "Volať neskôr",
  nedovolal:         "Nedovolal",
  nechce_rk:         "Nechce RK",
  uz_predal:         "Už predal",
  realna_kancelaria: "Realitná Kancelária",
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

export interface Klient {
  id: string;
  meno: string;
  mobil: string | null;
  email: string | null;
  status: StatusKlienta;
  typ: TypNehnutelnosti | null;
  lokalita: string | null;
  ulica: string | null;
  datum_stretnutia: string | null;
  rozpocet_min: number | null;
  rozpocet_max: number | null;
  priorita: Priorita;
  poznamka: string | null;
  created_at: string;
  updated_at: string;
}

export interface Nehnutelnost {
  id: string;
  nazov: string;
  typ: TypNehnutelnosti;
  lokalita: string;
  cena: number;
  plocha: number | null;
  izby: number | null;
  poschodie: number | null;
  popis: string | null;
  stav: StavNehnutelnosti | null;
  ai_skore: number | null;
  ai_analyza: string | null;
  url_inzercia: string | null;
  created_at: string;
  updated_at: string;
}

export interface Log {
  id: string;
  typ: string;
  popis: string;
  klient_id: string | null;
  nehnutelnost_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      klienti: {
        Row: Klient;
        Insert: Omit<Klient, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Klient, "id" | "created_at" | "updated_at">>;
      };
      nehnutelnosti: {
        Row: Nehnutelnost;
        Insert: Omit<Nehnutelnost, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Nehnutelnost, "id" | "created_at" | "updated_at">>;
      };
      logy: {
        Row: Log;
        Insert: Omit<Log, "id" | "created_at">;
        Update: never;
      };
    };
  };
}
