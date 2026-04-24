"use client";

import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { TypNehnutelnosti, StavNehnutelnosti } from "@/lib/database.types";
import { KRAJE } from "@/lib/database.types";
import { useAuth } from "@/components/AuthProvider";
import { getUserItem } from "@/lib/userStorage";
import { saveKlientDokument } from "@/lib/klientDokumenty";
import { uploadFoto, deleteFoto, normalizeVideoUrl, normalizeTour3D } from "@/lib/inzeratFotky";

/* ── Design tokens ── */
const s = {
  card: { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "24px", marginBottom: "12px" } as React.CSSProperties,
  input: { width: "100%", padding: "10px 14px", background: "var(--bg-elevated)", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "14px", color: "var(--text-primary)", outline: "none", transition: "border-color 0.15s" } as React.CSSProperties,
  select: { width: "100%", padding: "10px 14px", background: "var(--bg-elevated)", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "14px", color: "var(--text-primary)", outline: "none", cursor: "pointer", appearance: "none" as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px" } as React.CSSProperties,
  label: { fontSize: "12px", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px", display: "block" } as React.CSSProperties,
  title: { fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "18px", letterSpacing: "-0.01em" } as React.CSSProperties,
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } as React.CSSProperties,
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" } as React.CSSProperties,
};

function Tog({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label onClick={() => set(!on)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", cursor: "pointer", border: "1px solid var(--border)", borderRadius: "10px", background: on ? "var(--sidebar-active, rgba(59,130,246,0.08))" : "var(--bg-elevated)" }}>
        <div style={{ width: "36px", height: "22px", borderRadius: "11px", background: on ? "#3B82F6" : "var(--border)", position: "relative", transition: "background 0.15s", flexShrink: 0 }}>
        <div style={{ width: "18px", height: "18px", borderRadius: "9px", background: "#fff", position: "absolute", top: "2px", left: on ? "16px" : "2px", transition: "left 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
      </div>
      <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: on ? 600 : 400 }}>{label}</span>
    </label>
  );
}

/* ── Progress bar ── */
function Progress({ active, text }: { active: boolean; text: string }) {
  if (!active) return null;
  return (
    <div style={{ padding: "12px 20px", background: "#EFF6FF", borderRadius: "10px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ width: "16px", height: "16px", border: "2px solid #93C5FD", borderTopColor: "#3B82F6", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
      <span style={{ fontSize: "13px", fontWeight: "500", color: "#1D4ED8" }}>{text}</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes bounce{0%,60%,100%{transform:translateY(0) scale(.85);opacity:.3}30%{transform:translateY(-6px) scale(1);opacity:1}}@keyframes wiggle{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}@keyframes fade{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

const OKRESY: Record<string, string[]> = {
  "Bratislavský kraj": ["Bratislava I","Bratislava II","Bratislava III","Bratislava IV","Bratislava V","Malacky","Pezinok","Senec"],
  "Trnavský kraj": ["Dunajská Streda","Galanta","Hlohovec","Piešťany","Senica","Skalica","Trnava"],
  "Trenčínsky kraj": ["Bánovce nad Bebravou","Ilava","Myjava","Nové Mesto nad Váhom","Partizánske","Považská Bystrica","Prievidza","Púchov","Trenčín"],
  "Nitriansky kraj": ["Komárno","Levice","Nitra","Nové Zámky","Šaľa","Topoľčany","Zlaté Moravce"],
  "Žilinský kraj": ["Bytča","Čadca","Dolný Kubín","Kysucké Nové Mesto","Liptovský Mikuláš","Martin","Námestovo","Ružomberok","Turčianske Teplice","Tvrdošín","Žilina"],
  "Banskobystrický kraj": ["Banská Bystrica","Banská Štiavnica","Brezno","Detva","Krupina","Lučenec","Poltár","Revúca","Rimavská Sobota","Veľký Krtíš","Zvolen","Žarnovica","Žiar nad Hronom"],
  "Prešovský kraj": ["Bardejov","Humenné","Kežmarok","Levoča","Medzilaborce","Poprad","Prešov","Sabinov","Snina","Stará Ľubovňa","Stropkov","Svidník","Vranov nad Topľou"],
  "Košický kraj": ["Gelnica","Košice I","Košice II","Košice III","Košice IV","Košice-okolie","Michalovce","Rožňava","Sobrance","Spišská Nová Ves","Trebišov"],
};

const FUNNY_MSGS = [
  "Leštím formulácie…",
  "Hľadám lepšie slová…",
  "Prepisujem s citom…",
  "Ladím rytmus vety…",
  "Škrtám zbytočnosti…",
  "Vyberám to najlepšie…",
  "Cizelujem detaily…",
  "Premýšľam nad tónom…",
  "Dolaďujem obraty…",
  "Preformulovávam vety…",
  "Skúšam alternatívy…",
  "Upravujem tempo…",
  "Prispôsobujem štýl…",
  "Volím presné slová…",
  "Hľadám rovnováhu…",
  "Upresňujem význam…",
  "Vyvažujem vety…",
  "Dotýkam sa detailov…",
  "Zjemňujem prechody…",
  "Pribrusujem nuansy…",
];

const PORTALY = [
  { key: "nehnutelnosti_sk", label: "Nehnutelnosti.sk" },
  { key: "topreality", label: "TopReality.sk" },
  { key: "bazos", label: "Bazos.sk" },
  { key: "reality_sk", label: "Reality.sk" },
  { key: "realsoft", label: "RealSoft" },
  { key: "facebook", label: "Facebook" },
];

const defaultForm = {
  // Základné
  nazov: "", typ: "" as TypNehnutelnosti, lokalita: "", cena: "", kategoria: "",
  popis: "", url_inzercia: "", intro: "", text_popis: "", lv_text: "",
  // Zobrazenie
  zobrazovat_cenu: true, zobrazovat_mapu: true, zobrazovat_hypoteku: true,
  so_zmluvou: false, projekt: false, specialne_oznacenie: "", seo_keywords: "", meta_description: "", h1: "",
  // Lokácia
  stat: "Slovensko", kraj: "", okres: "", obec: "", ulica_verejna: "", ulica_privatna: "",
  makler: "Aleš Machovič", interne_id: "",
  // Rozšírené vlastnosti
  plocha: "", uzitkova_plocha: "", zastavana_plocha: "", podlahova_plocha: "", skladova_plocha: "",
  stav: "", energeticky_certifikat: "", energeticka_narocnost: "",
  typ_budovy: "", typ_vybavy: "",
  // Priestory
  poschodie: "", pozicia: "", celkova_plocha: "", izby: "",
  // Toggles — priestory
  balkon: false, loggia: false, terasa: false, garaz: false, pivnica: false,
  verejne_parkovanie: false, sukromne_parkovanie: false,
  spajza: false, sklad_toggle: false, dielna: false, vytah: false,
  // Detail priestorov
  balkon_plocha: "", loggia_plocha: "", loggia_pocet: "", terasa_plocha: "",
  pivnica_plocha: "", pivnica_pocet: "", parkovanie_typ: "",
  // Roky
  rok_vystavby: "", rok_rekonstrukcie: "", rok_kolaudacie: "",
  poschodia_vyssie: "", poschodia_nizsie: "",
  // Vykurovanie
  vykurovanie: { centralne: false, podlahove: false, lokalne: false, ine: false, kozub: false, klimatizacia: false, emitory: false } as Record<string, boolean>,
  // Pripojenie
  pripojenie: { telefon: false, internet: false, satelit: false, kablova_tv: false, opticka_siet: false, ine: false } as Record<string, boolean>,
  // Ďalšie
  orientacia: "", inzinierske_siete: false,
  typ_ceny: "", tagy: "", vlastnictvo: "", text_k_cene: "", cena_za_energie: "",
  exkluzivne: false, url_virtualka: "", vhodne_pre_studentov: false,
  video_url: "",
  // Náklady a právne
  mesacne_naklady: "", naklady_detail: "", pravne_vady: "",
  // Privátne
  provizia_hodnota: "", provizia_typ: "EUR", poznamka_interna: "",
  // Export
  export_portaly: { nehnutelnosti_sk: false, topreality: false, bazos: false, reality_sk: false, realsoft: false, facebook: false } as Record<string, boolean>,
};

export default function InzeratForm({ onSaved, onCancel, prefilledData }: { onSaved?: () => void; onCancel?: () => void; prefilledData?: Record<string, unknown> | null } = {}) {
  const { user: authUser } = useAuth();
  const uid = authUser?.id || "";
  // Rozlíš: prefilledData môže byť (a) existujúci inzerát z `nehnutelnosti` (edit mode),
  // alebo (b) náberový list z `naberove_listy` (prefill nového inzerátu).
  // Náberák má typ_nehnutelnosti/parametre — inzerát má typ/kategoria/status.
  const prefilledIsNaberak = !!prefilledData && (
    prefilledData.parametre !== undefined ||
    prefilledData.typ_nehnutelnosti !== undefined
  );
  const editId = prefilledIsNaberak ? undefined : ((prefilledData?.id as string | undefined) || undefined);
  const klientId = (prefilledData?.klient_id as string | undefined) || undefined;
  // Autosave draft kľúč (iba pre nové inzeráty — nie edit mód).
  // Keyed per klient, aby sa draft pre jedného klienta nemiešal s iným.
  const draftKey = editId ? null : `inzerat_draft_${klientId || "new"}`;
  const [f, setF] = useState(() => {
    // Ak existuje uložený draft (napr. po idle-logout), uprednostni ho pred prefillom.
    if (draftKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved) as { _v?: number; data?: Partial<typeof defaultForm> };
          if (parsed?._v === 1 && parsed.data) return { ...defaultForm, ...parsed.data };
        }
      } catch { /* ignore */ }
    }
    if (!prefilledData) return defaultForm;
    // Prefill z náberu — mapuj VŠETKY dostupné polia
    const d = prefilledData;
    const params = (d.parametre || {}) as Record<string, unknown>;
    const vyb = (d.vybavenie || {}) as Record<string, unknown>;

    // Mapuj amenity z náberu na toggle polia
    const hasAmenity = (name: string) => {
      if (!vyb) return false;
      // NaberyForm ukladá vybavenie ako {Balkón: true, Výťah: true, ...}
      return !!vyb[name];
    };

    // Vykurovanie z parametrov
    const vykurovanie = { ...defaultForm.vykurovanie };
    const kurenie = String(params.kurenie || "").toLowerCase();
    if (kurenie.includes("centrál")) vykurovanie.centralne = true;
    if (kurenie.includes("podlah")) vykurovanie.podlahove = true;
    if (kurenie.includes("lokál")) vykurovanie.lokalne = true;
    if (kurenie.includes("kozub") || kurenie.includes("krb")) vykurovanie.kozub = true;

    // Pripojenie z amenít
    const pripojenie = { ...defaultForm.pripojenie };
    if (hasAmenity("Telefón")) pripojenie.telefon = true;
    if (hasAmenity("Kábel") || hasAmenity("Satelit")) { pripojenie.kablova_tv = true; pripojenie.satelit = true; }

    return {
      ...defaultForm,
      typ: (() => {
        const raw = String(d.typ_nehnutelnosti || "").toLowerCase();
        const izby = Number((d.parametre as Record<string, unknown>)?.pocet_izieb || 0);
        if (raw === "byt") {
          if (izby === 1) return "1-izbovy-byt";
          if (izby === 2) return "2-izbovy-byt";
          if (izby === 3) return "3-izbovy-byt";
          if (izby === 4) return "4-izbovy-byt";
          if (izby >= 5) return "5-izbovy-byt";
          return "3-izbovy-byt";
        }
        if (raw === "rodinny_dom" || raw === "rodinný dom") return "rodinny-dom";
        if (raw === "pozemok") return "stavebny-pozemok";
        return String(d.typ_nehnutelnosti || defaultForm.typ);
      })() as TypNehnutelnosti,
      kraj: String(d.kraj || defaultForm.kraj),
      okres: String(d.okres || defaultForm.okres),
      obec: String(d.obec || defaultForm.obec),
      lokalita: String(d.obec || defaultForm.lokalita),
      ulica_verejna: String(d.ulica || defaultForm.ulica_verejna),
      plocha: (() => {
        // Pre byt nepoužívať plochu z LV (je to plocha parcely pod domom, nie podlahová plocha bytu)
        const rawTyp = String(d.typ_nehnutelnosti || "").toLowerCase();
        if (rawTyp === "byt") {
          const podlahova = Number((d.parametre as Record<string, unknown>)?.podlahova_plocha || 0);
          return podlahova > 0 ? String(podlahova) : defaultForm.plocha;
        }
        return String(d.plocha || defaultForm.plocha);
      })(),
      cena: String(d.predajna_cena || defaultForm.cena),
      stav: (() => {
        const raw = String(d.stav || "").toLowerCase();
        const map: Record<string, string> = {
          "novostavba": "novostavba", "povodny_stav": "povodny-stav",
          "kompletna_rekonstrukcia": "kompletna-rekonstrukcia",
          "ciastocna_rekonstrukcia": "ciastocne-prerobeny",
          "velmi_dobry": "uplne-prerobeny", "dobry": "ciastocne-prerobeny",
          "zly": "povodny-stav", "schatralý": "urcene-na-demolaciu",
          "vystavba": "vo-vystavbe",
        };
        return map[raw] || raw || defaultForm.stav;
      })(),
      izby: (() => {
        const fromParams = Number(params.pocet_izieb || 0);
        if (fromParams > 0) return String(fromParams);
        // Extract from kategória if available (e.g. "3-izbový byt" → 3)
        const kat = String(d.kategoria || d.typ_nehnutelnosti || "");
        const katMatch = kat.match(/(\d+)\s*-?\s*izb/i);
        if (katMatch) return katMatch[1];
        return defaultForm.izby;
      })(),
      poschodie: String(params.poschodie || defaultForm.poschodie),
      poschodia_vyssie: String(params.z_kolko || defaultForm.poschodia_vyssie),
      vlastnictvo: String(params.vlastnictvo || vyb.vlastnictvo || defaultForm.vlastnictvo),
      typ_budovy: String(params.typ_domu || defaultForm.typ_budovy),
      rok_vystavby: String(params.rok_vystavby || defaultForm.rok_vystavby),
      mesacne_naklady: String(params.mesacne_poplatky || defaultForm.mesacne_naklady),
      provizia_hodnota: (() => {
        const raw = String(d.provizia || "");
        if (!raw) return defaultForm.provizia_hodnota;
        // "4%" → calculate from predajna_cena
        const pctMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (pctMatch && d.predajna_cena) {
          const pct = parseFloat(pctMatch[1].replace(",", "."));
          return String(Math.round(Number(d.predajna_cena) * pct / 100));
        }
        // "5000€" or just number
        const numMatch = raw.match(/(\d+(?:[.,]\d+)?)/);
        return numMatch ? numMatch[1].replace(",", ".") : raw;
      })(),
      provizia_typ: (() => {
        const raw = String(d.provizia || "");
        if (raw.includes("%")) return "%" as const;
        return "EUR" as const;
      })(),
      poznamka_interna: String(d.popis || defaultForm.poznamka_interna),
      makler: String(d.makler || defaultForm.makler),
      // Typ výbavy z náberu (zariadený)
      typ_vybavy: (() => {
        const z = String((d.vybavenie as Record<string, unknown>)?.zariadeny || "").toLowerCase();
        if (z === "ano") return "uplne-zariadeny";
        if (z === "ciastocne") return "ciastocne-zariadeny";
        if (z === "nie") return "nezariadeny";
        return defaultForm.typ_vybavy;
      })(),
      // Priestory z amenít náberu
      balkon: hasAmenity("Balkón"),
      loggia: hasAmenity("Lodžia"),
      terasa: hasAmenity("Terasa"),
      garaz: hasAmenity("Garáž"),
      pivnica: hasAmenity("Pivnica"),
      vytah: hasAmenity("Výťah"),
      verejne_parkovanie: hasAmenity("Parking"),
      spajza: hasAmenity("Špajza") || hasAmenity("Komora"),
      // Kategória / typ ponuky z náberu
      kategoria: (() => {
        const ozn = String(d.oznacenie || "").toLowerCase();
        const typZmluvy = String(d.typ_zmluvy || "").toLowerCase();
        // Ak je výhradná zmluva alebo exkluzívna → IBA U NÁS
        if (typZmluvy.includes("exkluz") || ozn === "vyhradne" || ozn === "exkluzivne") return "iba-u-nas-predaj";
        // Ak máme predajnú cenu, je to predaj
        if (d.predajna_cena) return "na-predaj";
        return defaultForm.kategoria;
      })(),
      // Vykurovanie a pripojenie
      vykurovanie,
      pripojenie,
      // Výhľad
      orientacia: String(params.vyhlad || defaultForm.orientacia),
      // SEO — auto-fill
      specialne_oznacenie: (() => {
        const ozn = String(d.oznacenie || "").toLowerCase();
        if (ozn === "vyhradne" || ozn === "exkluzivne") return "top";
        if (d.predajna_cena) return "top";
        return defaultForm.specialne_oznacenie;
      })(),
      seo_keywords: (() => {
        const parts: string[] = [];
        const typN = String(d.typ_nehnutelnosti || "").toLowerCase();
        const izby = Number((d.parametre as Record<string, unknown>)?.pocet_izieb || 0);
        if (typN === "byt" && izby) parts.push(`${izby}-izbový byt`);
        else if (typN === "byt") parts.push("Byt");
        else if (typN === "rodinny_dom") parts.push("Rodinný dom");
        else if (typN === "pozemok") parts.push("Pozemok");
        const obec = String(d.obec || "");
        const okres = String(d.okres || "");
        if (obec) parts.push(obec);
        if (okres && okres !== obec) parts.push(okres);
        if (d.predajna_cena) parts.push("na predaj");
        const stav = String(d.stav || "");
        if (stav.includes("rekonstrukcia") || stav.includes("velmi_dobry")) parts.push("po rekonštrukcii");
        if (stav === "novostavba") parts.push("novostavba");
        return parts.join(" ") || defaultForm.seo_keywords;
      })(),
    };
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [refineMsgIdx, setRefineMsgIdx] = useState(0);
  const [parsingLV, setParsingLV] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [lvParsed, setLvParsed] = useState<Record<string, string> | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; name: string; url: string; thumb?: string; path?: string; size: number; uploading?: boolean; error?: string }[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [videoInput, setVideoInput] = useState("");
  const [docs, setDocs] = useState<{ name: string; type: string; size: number; text?: string; pdf_base64?: string }[]>([]);
  const klientIdForDocs = (prefilledData?.klient_id as string | undefined) || undefined;
  const [docQuery, setDocQuery] = useState("");
  const docHits = (() => {
    const q = docQuery.trim().toLowerCase();
    if (q.length < 2) return [] as { doc: string; snippet: string }[];
    const hits: { doc: string; snippet: string }[] = [];
    for (const d of docs) {
      if (!d.text) continue;
      const lower = d.text.toLowerCase();
      let idx = lower.indexOf(q);
      let count = 0;
      while (idx !== -1 && count < 3) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(d.text.length, idx + q.length + 80);
        hits.push({ doc: d.name, snippet: (start > 0 ? "…" : "") + d.text.slice(start, end).replace(/\s+/g, " ") + (end < d.text.length ? "…" : "") });
        idx = lower.indexOf(q, idx + q.length);
        count++;
      }
    }
    return hits.slice(0, 8);
  })();
  const [processingDoc, setProcessingDoc] = useState(-1);
  const [uploadingFile, setUploadingFile] = useState("");
  const aiRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prevent = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => { document.removeEventListener("dragover", prevent); document.removeEventListener("drop", prevent); };
  }, []);

  /* ── Načítaj existujúce fotky/videá pri edit móde ── */
  useEffect(() => {
    if (!prefilledData) return;
    const urls = (prefilledData.fotky_urls as string[]) || [];
    const thumbs = (prefilledData.fotky_thumbs as string[]) || [];
    if (urls.length > 0) {
      setPhotos(urls.map((u, i) => ({
        id: `db-${i}`,
        name: u.split("/").pop() || `foto-${i}`,
        url: u,
        thumb: thumbs[i] || u,
        path: u.includes("/inzerat-fotky/") ? u.split("/inzerat-fotky/")[1] : undefined,
        size: 0,
      })));
    }
    const vids = (prefilledData.videa_urls as string[]) || [];
    const legacyVideo = (prefilledData.video_url as string) || "";
    const merged = [...vids];
    if (legacyVideo && !merged.includes(legacyVideo)) {
      const n = normalizeVideoUrl(legacyVideo);
      merged.push(n || legacyVideo);
    }
    if (merged.length > 0) setVideos(merged);
  }, [prefilledData]);

  /* ── Náberák fallback — dva scenáre:
     A) Nový inzerát z náberáku (/inzerat?klient_id=X) — prefilledData JE náberák.
     B) Edit existujúceho inzerátu — fetchneme najnovší náberák klienta z DB.
     V oboch: len prázdne inzerátové polia dopĺňame. ── */
  const [naberakFilledFields, setNaberakFilledFields] = useState<string[]>([]);
  const [naberakRaw, setNaberakRaw] = useState<Record<string, unknown> | null>(null);
  const [maklerList, setMaklerList] = useState<{ id: string; meno: string; email: string }[]>([]);

  /* ── Načítaj zoznam maklérov z DB ── */
  useEffect(() => {
    supabase.from("makleri").select("id, meno, email").then(({ data }) => {
      if (data) setMaklerList(data as { id: string; meno: string; email: string }[]);
    });
  }, []);

  /* ── Autosave draft do localStorage (debounced ~800 ms) ── */
  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ _v: 1, data: f, savedAt: Date.now() }));
      } catch { /* quota / private mode — ignoruj */ }
    }, 800);
    return () => clearTimeout(t);
  }, [f, draftKey]);
  useEffect(() => {
    // Scenario A: prefilledData vyzerá ako náberák (má .parametre alebo .typ_nehnutelnosti)
    const prefillIsNaberak =
      prefilledData &&
      (prefilledData.parametre !== undefined || prefilledData.typ_nehnutelnosti !== undefined) &&
      !editId;
    if (prefillIsNaberak && prefilledData) {
      processNaberak(prefilledData as Record<string, unknown>);
      return;
    }
    // Scenario B: edit mode — fetch
    if (!editId || !klientId) return;
    (async () => {
      const { data } = await supabase
        .from("naberove_listy")
        .select("*")
        .eq("klient_id", klientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      processNaberak(data as Record<string, unknown>);
    })().catch(e => console.warn("[naberak fallback] failed:", e));

    function processNaberak(n: Record<string, unknown>) {
      setNaberakRaw(n);
      const params = (n.parametre || {}) as Record<string, unknown>;
      const vyb = (n.vybavenie || {}) as Record<string, unknown>;
      const vymery = (vyb.vymery || {}) as Record<string, unknown>;
      const stavBytu = (params.stav_bytu || {}) as Record<string, unknown>;
      const stavDomu = (params.stav_domu || {}) as Record<string, unknown>;

      // Banner list: čo náberák reálne má (nezáleží či initial state to už doplnil)
      const hasLabels: string[] = [];
      const addIf = (cond: unknown, label: string) => { if (cond) hasLabels.push(label); };
      addIf(n.kraj, "kraj");
      addIf(n.okres, "okres");
      addIf(n.obec, "obec");
      addIf(n.ulica, "ulica");
      addIf(n.plocha, "plocha");
      addIf(n.stav, "stav");
      addIf(n.predajna_cena, "cena");
      addIf(n.popis, "popis");
      addIf(n.typ_nehnutelnosti, "typ");
      addIf(params.pocet_izieb, "izby");
      addIf(params.poschodie, "poschodie");
      addIf(params.z_kolko, "celkom poschodí");
      addIf(params.vlastnictvo, "vlastníctvo");
      addIf(params.mesacne_poplatky, "mesačné poplatky");
      addIf(params.typ_domu, "typ budovy");
      addIf(params.rok_vystavby, "rok výstavby");
      addIf(stavBytu.rok_rekonstrukcie, "rok rekonštrukcie");
      addIf(params.kurenie, "kúrenie");
      addIf(params.vyhlad, "výhľad");
      addIf(params.typ_podlahy, "typ podlahy");
      addIf(params.tarcha_text, "právne ťarchy");
      addIf(stavDomu.zatepleny, "zatepl. dom");
      addIf(stavDomu.strecha_robena, "strecha");
      addIf(stavDomu.plasty_okna, "plast. okná");
      addIf(stavDomu.poznamka, "poznámka k stavu");
      addIf(vyb.balkon || vyb["Balkón"], "balkón");
      addIf(vyb.loggia || vyb["Loggia"], "loggia");
      addIf(vyb.terasa || vyb["Terasa"], "terasa");
      addIf(vyb.garaz || vyb["Garáž"], "garáž");
      addIf(vyb.pivnica || vyb["Pivnica"], "pivnica");
      addIf(vyb.vytah || vyb["Výťah"], "výťah");
      addIf(vyb.internet || vyb["Internet"], "internet");
      addIf(vyb.klimatizacia || vyb["Klimatizácia"], "klimatizácia");
      addIf(vyb.zariadeny, "zariadený");
      addIf(vymery.uzitkova, "úžitková plocha");
      addIf(vymery.balkon, "výmera balkóna");
      addIf(vymery.loggia, "výmera loggie");
      addIf(vymery.terasa, "výmera terasy");
      addIf(vymery.pivnica, "výmera pivnice");
      addIf(n.provizia, "provízia");
      setNaberakFilledFields(hasLabels);

      const filled: string[] = [];
      setF(prev => {
        const next: typeof prev = { ...prev };
        // Pomocník — nastav iba ak je aktuálne prázdne a nová hodnota existuje
        function fillEmpty<K extends keyof typeof prev>(key: K, value: unknown) {
          if (value === null || value === undefined || value === "") return;
          const cur = prev[key];
          if (cur !== "" && cur !== null && cur !== undefined && cur !== false) return;
          (next as Record<string, unknown>)[key as string] = value;
          filled.push(String(key));
        }

        // Lokalita
        fillEmpty("kraj", n.kraj);
        fillEmpty("okres", n.okres);
        fillEmpty("obec", n.obec);
        fillEmpty("ulica_verejna", n.ulica);
        // Základné
        fillEmpty("plocha", n.plocha);
        fillEmpty("stav", n.stav);
        fillEmpty("cena", n.predajna_cena);
        fillEmpty("popis", n.popis);
        fillEmpty("typ", n.typ_nehnutelnosti);
        fillEmpty("makler", n.makler);
        // Parametre JSONB
        fillEmpty("izby", params.pocet_izieb);
        fillEmpty("poschodie", params.poschodie);
        fillEmpty("poschodia_vyssie", params.z_kolko);
        fillEmpty("vlastnictvo", params.vlastnictvo);
        fillEmpty("mesacne_naklady", params.mesacne_poplatky);
        fillEmpty("typ_budovy", params.typ_domu);
        fillEmpty("rok_vystavby", params.rok_vystavby);
        fillEmpty("rok_rekonstrukcie", stavBytu.rok_rekonstrukcie);
        fillEmpty("pravne_vady", params.tarcha_text);
        fillEmpty("provizia_typ", params.provizia_typ);
        // Vybavenie toggles
        fillEmpty("balkon", vyb.balkon || vyb["Balkón"]);
        fillEmpty("loggia", vyb.loggia || vyb["Loggia"]);
        fillEmpty("terasa", vyb.terasa || vyb["Terasa"]);
        fillEmpty("garaz", vyb.garaz || vyb["Garáž"]);
        fillEmpty("pivnica", vyb.pivnica || vyb["Pivnica"]);
        fillEmpty("vytah", vyb.vytah || vyb["Výťah"]);
        fillEmpty("typ_vybavy", vyb.zariadeny);
        // Pripojenie z vybavenia
        if ((vyb.internet || vyb["Internet"]) && !prev.pripojenie?.internet) {
          next.pripojenie = { ...prev.pripojenie, internet: true };
          filled.push("pripojenie.internet");
        }
        // Klimatizácia → vykurovanie.klimatizacia
        if ((vyb.klimatizacia || vyb["Klimatizácia"]) && !prev.vykurovanie?.klimatizacia) {
          next.vykurovanie = { ...prev.vykurovanie, klimatizacia: true };
          filled.push("vykurovanie.klimatizacia");
        }
        // Výmery
        fillEmpty("uzitkova_plocha", vymery.uzitkova);
        fillEmpty("balkon_plocha", vymery.balkon);
        fillEmpty("loggia_plocha", vymery.loggia);
        fillEmpty("terasa_plocha", vymery.terasa);
        fillEmpty("pivnica_plocha", vymery.pivnica);
        // Provízia — extrahuj číslo z textu
        if ((prev.provizia_hodnota === "" || prev.provizia_hodnota === null) && typeof n.provizia === "string") {
          const num = n.provizia.match(/\d+/)?.[0];
          if (num) { next.provizia_hodnota = num; filled.push("provizia_hodnota"); }
        }
        // Kurenie string → vykurovanie toggles
        if (typeof params.kurenie === "string" && params.kurenie) {
          const kur = params.kurenie.toLowerCase();
          const vyk = { ...prev.vykurovanie };
          let changed = false;
          if (kur.includes("central") && !vyk.centralne) { vyk.centralne = true; changed = true; }
          if (kur.includes("podlah") && !vyk.podlahove) { vyk.podlahove = true; changed = true; }
          if (kur.includes("lokal") && !vyk.lokalne) { vyk.lokalne = true; changed = true; }
          if (kur.includes("kozub") && !vyk.kozub) { vyk.kozub = true; changed = true; }
          if (kur.includes("klima") && !vyk.klimatizacia) { vyk.klimatizacia = true; changed = true; }
          if (changed) { next.vykurovanie = vyk; filled.push("vykurovanie"); }
        }
        return next;
      });
      // filled zoznam (čo sa reálne prepísalo) ostáva pre debug/log, banner už
      // riadi hasLabels vyššie
      void filled;
    }
  }, [editId, klientId, prefilledData]);

  /* ── Rotácia vtipných hlášok pri úprave existujúceho textu ── */
  useEffect(() => {
    if (!generating) return;
    setRefineMsgIdx(Math.floor(Math.random() * FUNNY_MSGS.length));
    const id = setInterval(() => {
      setRefineMsgIdx(i => (i + 1) % FUNNY_MSGS.length);
    }, 1800);
    return () => clearInterval(id);
  }, [generating]);

  function set(k: string, v: string | boolean | number) { setF(p => ({ ...p, [k]: v })); }
  function setPr(k: string, v: boolean) { setF(p => ({ ...p, pripojenie: { ...p.pripojenie, [k]: v } })); }
  function setVyk(k: string, v: boolean) { setF(p => ({ ...p, vykurovanie: { ...p.vykurovanie, [k]: v } })); }
  function setEx(k: string, v: boolean) { setF(p => ({ ...p, export_portaly: { ...p.export_portaly, [k]: v } })); }
  function toggleAllPortals() {
    const allOn = PORTALY.every(p => f.export_portaly[p.key]);
    const next: Record<string, boolean> = {};
    PORTALY.forEach(p => next[p.key] = !allOn);
    setF(p => ({ ...p, export_portaly: next }));
  }

  function toBataCena(raw: string): string {
    const n = parseInt(raw.replace(/\s/g, ""), 10);
    if (!n || n <= 0) return raw;
    if (n < 1000) return String(Math.round(n / 100) * 100 - 1);
    return String(Math.round(n / 1000) * 1000 - 100);
  }

  /* ── Universal file handler ── */
  /* ── Detekcia typu dokumentu ── */
  function detectDocType(text: string, fileName: string): "lv" | "posudok" | "zmluva" | "dokument" {
    const lower = text.toLowerCase();
    const nameLower = fileName.toLowerCase();
    // LV musí mať viaceré špecifické znaky naraz
    const lvSignals = [
      "list vlastníctva", "lv č.", "katastrálny úrad", "katastrálne územie",
      "časť a", "časť b", "časť c", "správa katastra", "okres:", "obec:",
      "parcely registra", "spoluvlastnícky podiel", "druh pozemku"
    ];
    const lvScore = lvSignals.filter(w => lower.includes(w)).length;
    // Znalecký posudok
    const posudokSignals = [
      "znalecký posudok", "znalec", "všeobecná hodnota", "ohodnotenie",
      "technická hodnota", "východisková hodnota", "koeficient", "opotrebenie",
      "podlahová plocha", "obhliadka", "zadávateľ", "výpočet hodnoty",
      "porovnávacia metóda", "prílohy k posudku"
    ];
    const posudokScore = posudokSignals.filter(w => lower.includes(w)).length;
    // Zmluva
    const zmluvaSignals = [
      "kúpna zmluva", "zmluva o prevode", "predávajúci", "kupujúci",
      "zmluvné strany", "predmet zmluvy", "kúpna cena", "zmluva o budúcej",
      "nájomná zmluva", "prenajímateľ", "nájomca", "nadobúdací doklad"
    ];
    const zmluvaScore = zmluvaSignals.filter(w => lower.includes(w)).length;
    // Aj názov súboru pomáha
    if (nameLower.includes("posudok") || nameLower.includes("znalec")) return "posudok";
    if (nameLower.includes("zmluva") || nameLower.includes("nadobud") || nameLower.includes("doklad")) return "zmluva";
    if (nameLower.includes("lv") || nameLower.includes("list vlastn")) return "lv";
    // Rozhodnutie podľa skóre — LV vyžaduje silnejšiu zhodu (min 3)
    if (lvScore >= 3 && lvScore > posudokScore) return "lv";
    if (posudokScore >= 2) return "posudok";
    if (zmluvaScore >= 2) return "zmluva";
    if (lvScore >= 2) return "lv";
    return "dokument";
  }

  function handleFiles(files: FileList | File[]) {
    Array.from(files).forEach(file => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isImg = file.type.startsWith("image/") || ["jpg","jpeg","png","webp","gif","heic"].includes(ext);
      const isPdf = file.type === "application/pdf" || ext === "pdf";
      const isDocx = ext === "docx" || file.type.includes("wordprocessingml");

      if (isImg) {
        // Okamžitý blob-URL preview + paralelný upload do Supabase Storage.
        const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const blobUrl = URL.createObjectURL(file);
        setPhotos(prev => [...prev, { id: localId, name: file.name, url: blobUrl, size: file.size, uploading: true }]);
        (async () => {
          try {
            const up = await uploadFoto(file, { userId: uid, inzeratId: editId });
            setPhotos(prev => prev.map(p => p.id === localId ? {
              id: localId, name: up.name, url: up.url, thumb: up.thumb, path: up.path, size: up.size, uploading: false,
            } : p));
            URL.revokeObjectURL(blobUrl);
          } catch (e) {
            console.error("[upload] foto failed:", e);
            setPhotos(prev => prev.map(p => p.id === localId ? { ...p, uploading: false, error: String((e as Error)?.message || e).slice(0, 100) } : p));
          }
        })();
      } else if (isDocx) {
        setUploadingFile(file.name);
        setParsingLV(true);
        (async () => {
          try {
            const fd = new FormData(); fd.append("file", file);
            console.log("[upload] parse-doc DOCX, size:", file.size);
            const res = await globalThis.fetch("/api/parse-doc", { method: "POST", body: fd });
            const parsed = await res.json().catch(() => ({ error: "Neplatná odpoveď" }));
            console.log("[upload] parse-doc DOCX response:", parsed);
            setDocs(prev => [...prev, { name: file.name, type: "Zmluva", size: file.size }]);
            if (klientIdForDocs) {
              file.arrayBuffer().then(buf => {
                const bytes = new Uint8Array(buf);
                let bin = ""; const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk) as unknown as number[]);
                saveKlientDokument({ klient_id: klientIdForDocs, name: file.name, type: "Zmluva", size: file.size, source: "inzerat", mime: file.type, data_base64: btoa(bin) }).catch(()=>{});
              });
            }
            if (parsed && !parsed.error) {
              fillFormFromAI(parsed as Record<string, string>);
            } else {
              setError((parsed?.error as string) || "DOCX parsing zlyhal.");
            }
          } catch (e) {
            console.error("[upload] DOCX failed:", e);
            setError("Nepodarilo sa spracovať DOCX.");
          } finally {
            setParsingLV(false); setUploadingFile("");
          }
        })();
      } else if (isPdf) {
        setUploadingFile(file.name);
        setParsingLV(true);
        (async () => {
          const SMALL_FILE_LIMIT = 3 * 1024 * 1024; // 3MB — bezpečne pod Vercel JSON body limit
          const nameLower = file.name.toLowerCase();
          const docType: "posudok" | "zmluva" | "lv" =
            nameLower.includes("posudok") || nameLower.includes("znalec") ? "posudok"
            : nameLower.includes("lv") || nameLower.includes("list vlastn") ? "lv"
            : "zmluva";
          const typeLabel = docType === "posudok" ? "Znalecký posudok" : docType === "lv" ? "List vlastníctva" : "Zmluva";
          try {
            // 1. Unified parse-doc — multipart ak ≤3.5MB, inak rasterizuj PDF na JPEG-y
            const MULTIPART_LIMIT = 0; // vždy rasterizovať PDF client-side (vyhnúť sa Vercel 60s timeout)
            console.log("[upload] parse-doc started, size:", file.size);
            let parsed: Record<string, unknown> = {};
            if (file.size <= MULTIPART_LIMIT) {
              const fd = new FormData(); fd.append("file", file);
              const res = await globalThis.fetch("/api/parse-doc", { method: "POST", body: fd });
              parsed = await res.json().catch(() => ({ error: "Neplatná odpoveď" }));
            } else {
              // rasterizácia cez pdfjs-dist — stránky → JPEG
              console.log("[upload] file > 3.5MB, rasterizing...");
              const pdfjs = await import("pdfjs-dist");
              pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
              const buf = await file.arrayBuffer();
              const doc = await pdfjs.getDocument({ data: buf }).promise;
              const images: string[] = [];
              const maxPages = Math.min(doc.numPages, 20);
              const BODY_BUDGET = 3.8 * 1024 * 1024; // pod Vercel limit
              let totalSize = 0;
              for (let i = 1; i <= maxPages; i++) {
                const page = await doc.getPage(i);
                const viewport = page.getViewport({ scale: 1.0 });
                const canvas = document.createElement("canvas");
                canvas.width = viewport.width; canvas.height = viewport.height;
                const ctx = canvas.getContext("2d")!;
                await page.render({ canvasContext: ctx, viewport, canvas }).promise;
                let quality = 0.55;
                let b64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
                // adaptívna kompresia ak sa blížime limitu
                while (totalSize + b64.length > BODY_BUDGET && quality > 0.25) {
                  quality -= 0.1;
                  b64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
                }
                if (totalSize + b64.length > BODY_BUDGET) {
                  console.warn("[upload] budget full, skipping remaining pages at", i);
                  break;
                }
                images.push(b64);
                totalSize += b64.length;
              }
              console.log("[upload] rasterized", images.length, "pages, total b64:", totalSize);
              const res = await globalThis.fetch("/api/parse-doc", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, images }),
              });
              parsed = await res.json().catch(() => ({ error: "Neplatná odpoveď" }));
            }
            console.log("[upload] parse-doc response:", parsed);

            // 2. base64 pre uloženie ku klientovi (ak sa zmestí)
            let b64: string | undefined;
            if (file.size <= SMALL_FILE_LIMIT) {
              try {
                const bytes = new Uint8Array(await file.arrayBuffer());
                let binary = ""; const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                  binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
                }
                b64 = btoa(binary);
              } catch (e) { console.warn("[upload] base64 failed:", e); }
            }

            // 3. Pridaj do docs
            setDocs(prev => [...prev, { name: file.name, type: typeLabel, size: file.size, pdf_base64: b64 }]);

            // 4. Ulož ku klientovi
            if (klientIdForDocs) {
              saveKlientDokument({ klient_id: klientIdForDocs, name: file.name, type: typeLabel, size: file.size, source: "inzerat", mime: file.type, data_base64: b64 }).catch(() => {});
            }

            if (parsed && !parsed.error) {
              fillFormFromAI(parsed as Record<string, string>);
              setDocs(prev => prev.map(d => d.name === file.name ? { ...d, type: `${typeLabel} ✓` } : d));
            } else {
              setError((parsed?.error as string) || "AI nevrátila žiadne dáta — skús ⚡AI manuálne.");
            }
          } catch (e) {
            console.error("[upload] PDF processing failed:", e);
            setError("Nepodarilo sa spracovať PDF.");
          } finally {
            setParsingLV(false);
            setUploadingFile("");
          }
        })();
      } else if (["txt","doc","docx"].includes(ext)) {
        const reader = new FileReader();
        reader.onload = ev => {
          const t = ev.target?.result;
          if (typeof t === "string" && t.trim()) {
            const docType = detectDocType(t, file.name);
            if (docType === "lv") { set("lv_text", t); handleParseLV(t); }
            else { setDocs(prev => [...prev, { name: file.name, type: docType === "posudok" ? "Znalecký posudok" : docType === "zmluva" ? "Zmluva" : ext.toUpperCase(), size: file.size, text: t }]); }
          }
        };
        reader.readAsText(file);
      } else {
        setDocs(prev => [...prev, { name: file.name, type: ext.toUpperCase(), size: file.size }]);
      }
    });
  }

  function handleDrop(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDropOver(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }

  /* ── Mapovanie typu z AI na hodnotu selectu ── */
  const typMap: Record<string, string> = {
    "byt": "2-izbovy-byt", "1-izbový byt": "1-izbovy-byt", "2-izbový byt": "2-izbovy-byt",
    "3-izbový byt": "3-izbovy-byt", "4-izbový byt": "4-izbovy-byt", "5-izbový byt": "5-izbovy-byt",
    "garsónka": "garsonka", "dvojgarsónka": "dvojgarsonka", "mezonet": "mezonet", "loft": "loft",
    "dom": "rodinny-dom", "rodinný dom": "rodinny-dom", "rodinny dom": "rodinny-dom",
    "chata": "chata", "vidiecky dom": "vidiecky-dom", "zrub": "zrub",
    "pozemok": "stavebny-pozemok", "záhrada": "zahrada", "orná pôda": "orna-poda", "les": "les",
    "garáž": "komercny-objekt", "garaz": "komercny-objekt",
    "komerčné": "komercny-objekt", "komercne": "komercny-objekt",
    "kancelárie": "kancelarie", "sklad": "sklad", "reštaurácia": "restauracia",
  };
  const materialMap: Record<string, string> = {
    "tehla": "tehlova", "panel": "panelova", "skelet": "zmiešaná",
    "drevo": "drevena", "ine": "ina",
  };
  const stavMap: Record<string, string> = {
    "novostavba": "novostavba", "povodny-stav": "povodny-stav", "pôvodný stav": "povodny-stav",
    "povodny_stav": "povodny-stav",
    "kompletna_rekonstrukcia": "kompletna-rekonstrukcia", "kompletná rekonštrukcia": "kompletna-rekonstrukcia",
    "ciastocna_rekonstrukcia": "ciastocne-prerobeny", "čiastočná rekonštrukcia": "ciastocne-prerobeny",
    "uplne-prerobeny": "uplne-prerobeny", "úplne prerobený": "uplne-prerobeny",
    "velmi_dobry": "uplne-prerobeny", "dobry": "ciastocne-prerobeny",
    "ciastocne-prerobeny": "ciastocne-prerobeny", "čiastočne prerobený": "ciastocne-prerobeny",
    "vo-vystavbe": "vo-vystavbe", "vo výstavbe": "vo-vystavbe",
    "vystavba": "vo-vystavbe", "zly": "povodny-stav", "schatralý": "urcene-na-demolaciu",
  };

  /* ── Spoločná funkcia na vyplnenie formulára z AI dát ── */
  function fillFormFromAI(data: Record<string, string>, lvText?: string) {
    // Zostavenie prehľadu extrahovaných dát
    const filled: Record<string, string> = {};
    if (data.obec) filled["Obec"] = data.obec;
    if (data.katastralneUzemie) filled["k.ú."] = data.katastralneUzemie;
    if (data.okres) filled["Okres"] = data.okres;
    if (data.kraj) filled["Kraj"] = data.kraj;
    if (data.ulica) filled["Ulica"] = data.ulica;
    if (data.cena) filled["Cena"] = data.cena + " €";
    if (data.plocha) filled["Plocha"] = data.plocha + " m²";
    if (data.uzitkova_plocha) filled["Úžitková"] = data.uzitkova_plocha + " m²";
    if (data.vlastnictvo) filled["Vlastníctvo"] = data.vlastnictvo;
    if (data.typ) filled["Typ"] = data.typ;
    if (data.stav) filled["Stav"] = data.stav;
    if (data.material) filled["Materiál"] = data.material;
    if (data.kategoria) filled["Kategória"] = data.kategoria === "predaj" ? "Predaj" : "Prenájom";
    if (data.izby) filled["Izby"] = data.izby;
    if (data.poschodie) filled["Poschodie"] = data.poschodie;
    if (data.balkon_plocha) filled["Balkón"] = data.balkon_plocha + " m²";
    if (data.loggia_plocha) filled["Loggia"] = data.loggia_plocha + " m²";
    if (data.pivnica_plocha) filled["Pivnica"] = data.pivnica_plocha + " m²";
    if (data.parcela) filled["Parcela"] = data.parcela;
    if (data.supisne_cislo) filled["Súp. číslo"] = data.supisne_cislo;
    if (data.energeticky_certifikat) filled["Energ. certifikát"] = data.energeticky_certifikat;
    if (data.vykurovanie) filled["Kúrenie"] = data.vykurovanie;
    if (data.mesacne_naklady) filled["Mesačné náklady"] = data.mesacne_naklady + " €";
    if (data.rok_kolaudacie) filled["Rok kolaudácie"] = data.rok_kolaudacie;
    if (data.rok_vystavby) filled["Rok výstavby"] = data.rok_vystavby;
    if (data.pravne_vady) filled["⚠ Právne vady"] = data.pravne_vady;
    if (data._ai) filled["AI"] = data._ai;
    setLvParsed(prev => ({ ...(prev || {}), ...filled }));

    // Auto-derive pozícia bytu
    let pozicia = "";
    if (data.poschodie) {
      const p = parseInt(data.poschodie, 10);
      if (p <= 0) pozicia = "prizemia";
      else if (p <= 2) pozicia = "nizsie-poschodie";
      else if (p <= 5) pozicia = "stredne-poschodie";
      else pozicia = "vyssie-poschodie";
    }

    const krajMatch = data.kraj ? KRAJE.find(k => k.toLowerCase().includes(data.kraj.toLowerCase().replace(" kraj", "").replace("ý", ""))) : undefined;
    const lokalitaParts = [data.ulica, data.obec, data.okres, data.kraj].filter(Boolean);
    const poznámky = [data.pravne_vady, data.poznamka, data.naklady_detail].filter(Boolean).join(". ");

    // Vykurovanie toggles
    const vykMap: Record<string, string> = {
      "centralne": "centralne", "centrálne": "centralne",
      "lokalne": "lokalne", "lokálne": "lokalne",
      "podlahove": "podlahove", "podlahové": "podlahove",
      "kozub": "kozub", "ine": "ine",
    };

    setF(prev => {
      const next = { ...prev };
      if (lvText) next.lv_text = lvText;
      // Základ
      next.obec = data.obec || prev.obec;
      next.okres = data.okres || prev.okres;
      next.kraj = (krajMatch || data.kraj || prev.kraj) as string;
      next.ulica_verejna = data.ulica || prev.ulica_verejna;
      next.lokalita = lokalitaParts.join(", ") || prev.lokalita;
      next.stat = "Slovensko";
      next.typ = ((): TypNehnutelnosti => {
        const rawTyp = (data.typ || "").toLowerCase().trim();
        const izbyNum = Number(data.izby) || 0;
        // Ak je typ len "byt" (bez čísla izieb), odvoď z data.izby
        if (rawTyp === "byt" && izbyNum > 0) {
          if (izbyNum === 1) return "1-izbovy-byt" as TypNehnutelnosti;
          if (izbyNum === 2) return "2-izbovy-byt" as TypNehnutelnosti;
          if (izbyNum === 3) return "3-izbovy-byt" as TypNehnutelnosti;
          if (izbyNum === 4) return "4-izbovy-byt" as TypNehnutelnosti;
          if (izbyNum >= 5) return "5-izbovy-byt" as TypNehnutelnosti;
        }
        return ((rawTyp && typMap[rawTyp]) || prev.typ) as TypNehnutelnosti;
      })();
      next.kategoria = data.kategoria || prev.kategoria;
      next.cena = data.cena || prev.cena;
      next.plocha = data.plocha || prev.plocha;
      next.uzitkova_plocha = data.uzitkova_plocha || prev.uzitkova_plocha;
      next.izby = data.izby || prev.izby;
      next.poschodie = data.poschodie || prev.poschodie;
      next.poschodia_vyssie = data.poschodia_vyssie || prev.poschodia_vyssie;
      next.poschodia_nizsie = data.poschodia_nizsie || prev.poschodia_nizsie;
      next.vlastnictvo = data.vlastnictvo || prev.vlastnictvo;
      next.orientacia = data.orientacia || prev.orientacia;
      next.pozicia = pozicia || prev.pozicia;
      // Stav a materiál
      next.stav = (data.stav && (stavMap[data.stav.toLowerCase()] || data.stav)) || prev.stav;
      next.typ_budovy = (data.material && (materialMap[data.material.toLowerCase()] || data.material)) || prev.typ_budovy;
      next.energeticky_certifikat = data.energeticky_certifikat || prev.energeticky_certifikat;
      // Roky
      next.rok_vystavby = data.rok_vystavby || prev.rok_vystavby;
      next.rok_kolaudacie = data.rok_kolaudacie || prev.rok_kolaudacie;
      // Priestory — toggles
      if (data.balkon === "true") next.balkon = true;
      if (data.loggia === "true") next.loggia = true;
      if (data.terasa === "true") next.terasa = true;
      if (data.pivnica === "true") next.pivnica = true;
      if (data.garaz === "true") next.garaz = true;
      if (data.vytah === "true") next.vytah = true;
      if (data.klimatizacia === "true") next.vykurovanie = { ...next.vykurovanie, klimatizacia: true };
      // Priestory — plochy
      if (data.balkon_plocha) next.balkon_plocha = data.balkon_plocha;
      if (data.loggia_plocha) next.loggia_plocha = data.loggia_plocha;
      if (data.terasa_plocha) next.terasa_plocha = data.terasa_plocha;
      if (data.pivnica_plocha) next.pivnica_plocha = data.pivnica_plocha;
      if (data.parkovanie) next.parkovanie_typ = data.parkovanie;
      // Vykurovanie
      if (data.vykurovanie) {
        const vk = data.vykurovanie.toLowerCase();
        const key = vykMap[vk];
        if (key) next.vykurovanie = { ...next.vykurovanie, [key]: true };
      }
      // Náklady a právne
      next.mesacne_naklady = data.mesacne_naklady || prev.mesacne_naklady;
      next.naklady_detail = data.naklady_detail || prev.naklady_detail;
      next.pravne_vady = data.pravne_vady || prev.pravne_vady;
      // Siete
      if (data.inzinierske_siete === "true") next.inzinierske_siete = true;
      // ID
      next.interne_id = data.supisne_cislo ? `LV-${data.supisne_cislo}` : prev.interne_id;
      // Poznámky
      if (poznámky) next.poznamka_interna = prev.poznamka_interna ? `${prev.poznamka_interna}. ${poznámky}` : poznámky;
      return next;
    });
  }

  /* ── Parse LV ── */
  async function handleParseLV(textOverride?: string) {
    const lvText = textOverride ?? f.lv_text;
    if (!lvText.trim()) return;
    setParsingLV(true);
    try {
      const res = await globalThis.fetch("/api/parse-lv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lv_text: lvText }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fillFormFromAI(data, lvText);
    } catch { setError("Nepodarilo sa spracovať dokument."); }
    setParsingLV(false);
  }

  /* ── Process any document via AI (znalecký posudok, zmluva, etc.) ── */
  async function handleProcessDoc(idx: number, docType?: string) {
    const doc = docs[idx];
    if (!doc?.text && !doc?.pdf_base64) return;
    setProcessingDoc(idx);
    try {
      const dt = (docType || doc.type?.toLowerCase() || "").replace("✓", "").trim();
      const normalizedDt = dt.includes("posudok") || dt.includes("znalec") ? "posudok"
        : dt.includes("zmluva") || dt.includes("doklad") ? "zmluva"
        : dt.includes("lv") ? "lv" : "zmluva";
      console.log("[manual-AI] sending", { hasText: !!doc.text, hasPdf: !!doc.pdf_base64, docType: normalizedDt });
      const res = await globalThis.fetch("/api/parse-lv", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lv_text: doc.text || "(viď PDF)", doc_type: normalizedDt, pdf_base64: doc.pdf_base64 }),
      });
      const data = await res.json();
      console.log("[manual-AI] response", data);
      if (data.error) throw new Error(data.error);
      fillFormFromAI(data);
      const label = doc.type?.includes("✓") ? doc.type : `${doc.type} ✓`;
      setDocs(prev => prev.map((d, i) => i === idx ? { ...d, type: label } : d));
    } catch (e) { console.error("[manual-AI] failed", e); setError("Nepodarilo sa spracovať dokument."); }
    setProcessingDoc(-1);
  }

  /* ── AI context ── */
  function buildContext(): string {
    const l: string[] = [];
    l.push("═══ FORMULÁROVÉ ÚDAJE (orientačné — dokumenty nižšie majú PREDNOSŤ) ═══");
    if (f.kategoria) l.push(`Ponuka: ${f.kategoria}`);
    if (f.typ) l.push(`Typ: ${f.typ}`);
    // Derive izby from typ if typ contains a number (e.g. "3-izbovy-byt" → 3)
    const typIzbyMatch = f.typ.match(/(\d+)-izb/);
    const effectiveIzby = typIzbyMatch ? typIzbyMatch[1] : f.izby;
    if (effectiveIzby) l.push(`Izby (formulár): ${effectiveIzby}`);
    if (f.stav) l.push(`Stav: ${f.stav}`);
    if (f.cena) l.push(`Cena: ${f.cena} €`);
    if (f.plocha) l.push(`Plocha (formulár): ${f.plocha} m²`);
    if (f.uzitkova_plocha) l.push(`Úžitková plocha: ${f.uzitkova_plocha} m²`);
    if (f.zastavana_plocha) l.push(`Zastavaná plocha: ${f.zastavana_plocha} m²`);
    if (f.poschodie) l.push(`Poschodie: ${f.poschodie}`);
    if (f.poschodia_vyssie) l.push(`Z celkom poschodí: ${f.poschodia_vyssie}`);
    const lok = [f.ulica_verejna, f.obec, f.okres, f.kraj].filter(Boolean).join(", ");
    if (lok) l.push(`Lokalita: ${lok}`);
    if (f.orientacia) l.push(`Orientácia: ${f.orientacia}`);
    if (f.vlastnictvo) l.push(`Vlastníctvo: ${f.vlastnictvo}`);
    if (f.typ_budovy) l.push(`Typ budovy: ${f.typ_budovy}`);
    if (f.typ_vybavy) l.push(`Výbava: ${f.typ_vybavy}`);
    if (f.rok_vystavby) l.push(`Rok výstavby: ${f.rok_vystavby}`);
    if (f.rok_rekonstrukcie) l.push(`Rok rekonštrukcie: ${f.rok_rekonstrukcie}`);
    if (f.energeticky_certifikat) l.push(`Energetický certifikát: ${f.energeticky_certifikat}`);
    if (f.mesacne_naklady) l.push(`Mesačné náklady: ${f.mesacne_naklady} €`);
    if (f.cena_za_energie) l.push(`Energie: ${f.cena_za_energie} €/mes`);
    // Vybavenie
    const vyb: string[] = [];
    if (f.balkon) vyb.push(`Balkón${f.balkon_plocha ? ` ${f.balkon_plocha} m²` : ""}`);
    if (f.loggia) vyb.push(`Loggia${f.loggia_plocha ? ` ${f.loggia_plocha} m²` : ""}`);
    if (f.terasa) vyb.push(`Terasa${f.terasa_plocha ? ` ${f.terasa_plocha} m²` : ""}`);
    if (f.garaz) vyb.push("Garáž");
    if (f.pivnica) vyb.push(`Pivnica${f.pivnica_plocha ? ` ${f.pivnica_plocha} m²` : ""}`);
    if (f.vytah) vyb.push("Výťah");
    if (f.spajza) vyb.push("Špajza");
    if (f.verejne_parkovanie) vyb.push("Verejné parkovanie");
    if (f.sukromne_parkovanie) vyb.push("Súkromné parkovanie");
    if (vyb.length > 0) l.push(`Vybavenie: ${vyb.join(", ")}`);
    // Vykurovanie
    const vyk = Object.entries(f.vykurovanie).filter(([, v]) => v).map(([k]) => k);
    if (vyk.length > 0) l.push(`Vykurovanie: ${vyk.join(", ")}`);
    // Pripojenie
    const prip = Object.entries(f.pripojenie).filter(([, v]) => v).map(([k]) => k);
    if (prip.length > 0) l.push(`Pripojenie: ${prip.join(", ")}`);
    if (f.popis) l.push(`Poznámka makléra: ${f.popis}`);

    // ── Extra údaje z náberového listu (pre AI text, nie všetky polia formulára) ──
    if (naberakRaw) {
      const np = (naberakRaw.parametre || {}) as Record<string, unknown>;
      const nv = (naberakRaw.vybavenie || {}) as Record<string, unknown>;
      const sd = (np.stav_domu || {}) as Record<string, unknown>;
      const sb = (np.stav_bytu || {}) as Record<string, unknown>;
      const extras: string[] = [];
      if (np.kurenie) extras.push(`Kúrenie (z náberáku): ${np.kurenie}`);
      if (np.vyhlad) extras.push(`Výhľad: ${np.vyhlad}`);
      if (np.typ_podlahy) extras.push(`Typ podlahy: ${np.typ_podlahy}`);
      if (sd.zatepleny) extras.push("Zateplený dom");
      if (sd.strecha_robena) extras.push("Strecha robená (rekonštruovaná)");
      if (sd.plasty_okna) extras.push("Plastové okná");
      if (sd.stupacky_menene) extras.push("Stúpačky vymenené");
      if (sd.rozvody_menene) extras.push("Rozvody vymenené");
      if (sd.poznamka) extras.push(`Poznámka k stavu domu: ${sd.poznamka}`);
      if (sb.energ_certifikat) extras.push("Má energetický certifikát");
      if (sb.kuchyna && Array.isArray(sb.kuchyna) && sb.kuchyna.length) extras.push(`Kuchyňa: ${(sb.kuchyna as string[]).join(", ")}`);
      if (sb.kupelna && Array.isArray(sb.kupelna) && sb.kupelna.length) extras.push(`Kúpeľňa: ${(sb.kupelna as string[]).join(", ")}`);
      if (sb.podlahy && Array.isArray(sb.podlahy) && sb.podlahy.length) extras.push(`Podlahy: ${(sb.podlahy as string[]).join(", ")}`);
      if (nv.zariadeny && typeof nv.zariadeny === "string") extras.push(`Zariadený: ${nv.zariadeny}`);
      if (naberakRaw.poznamky_vybavenie) extras.push(`Poznámky k vybaveniu: ${naberakRaw.poznamky_vybavenie}`);
      if (extras.length > 0) {
        l.push(`\n═══ NÁBEROVÝ LIST — DETAILY (použi v texte inzerátu ak sedia) ═══`);
        extras.forEach(e => l.push(`• ${e}`));
      }
    }

    l.push("\n═══ DOKUMENTY (AUTORITATÍVNE — tieto údaje majú PREDNOSŤ pred formulárom) ═══");
    l.push("⚠️ Ak dokumenty uvádzajú iný počet izieb, plochu alebo adresu než formulár — POUŽI ÚDAJ Z DOKUMENTOV!");
    // Dokumenty — texty z PDF
    if (f.lv_text) l.push(`\n--- LIST VLASTNÍCTVA (AUTORITATÍVNY) ---\n${f.lv_text}`);
    if (lvParsed) { l.push("\n--- EXTRAHOVANÉ Z LV (AUTORITATÍVNE) ---"); Object.entries(lvParsed).forEach(([k, v]) => l.push(`${k}: ${v}`)); }
    if (docs.length > 0) {
      docs.forEach(d => {
        if (d.text) l.push(`\n--- DOKUMENT: ${d.name} (${d.type}) — AUTORITATÍVNY ---\n${d.text}`);
      });
    }
    if (f.pravne_vady) l.push(`\nPrávne ťarchy (NESPOMÍNAJ v inzeráte): ${f.pravne_vady}`);
    return l.join("\n");
  }

  async function handleGenerate() {
    if (generating) return; // guard proti dvojitému spusteniu
    const ctx = buildContext();
    if (!ctx.trim() && photos.length === 0 && docs.length === 0) {
      setError("Pridaj aspoň fotky, dokument alebo vyplň základné údaje.");
      return;
    }
    setGenerating(true);
    try {
      // Konvertuj fotky na base64 (max 3 reprezentatívnych, 720px, q 0.6) — rýchlejšia vision inferencia
      const photoB64: string[] = [];
      // Vyber rovnomerne rozložené fotky (nie len prvých)
      const PHOTO_LIMIT = 3;
      const step = Math.max(1, Math.floor(photos.length / PHOTO_LIMIT));
      const sampled = photos.filter((_, i) => i % step === 0).slice(0, PHOTO_LIMIT);
      let totalBytes = 0;
      const PHOTO_BUDGET = 2 * 1024 * 1024;
      for (const p of sampled) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = p.url; });
          const canvas = document.createElement("canvas");
          const maxW = 720;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctxC = canvas.getContext("2d");
          ctxC?.drawImage(img, 0, 0, canvas.width, canvas.height);
          let q = 0.6;
          let dataUrl = canvas.toDataURL("image/jpeg", q);
          while (totalBytes + dataUrl.length > PHOTO_BUDGET && q > 0.3) {
            q -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", q);
          }
          if (totalBytes + dataUrl.length > PHOTO_BUDGET) break;
          photoB64.push(dataUrl);
          totalBytes += dataUrl.length;
        } catch { /* skip */ }
      }
      console.log("[ai-writer] sending", photoB64.length, "photos, total:", totalBytes);

      // Lokalita — priorita: ulica > obec > okres
      const lokalitaFull = [f.ulica_verejna, f.obec, f.okres, f.kraj].filter(Boolean).join(", ");

      // Load makler profile z localStorage (per-device)
      let maklerMeno = "", maklerTelefon = "", maklerEmail = "", vzorovyInzerat = "";
      try {
        const mp = getUserItem(uid, "makler_profile");
        if (mp) {
          const p = JSON.parse(mp);
          maklerMeno = p.meno || "";
          maklerTelefon = p.telefon || "";
          maklerEmail = p.email || "";
        }
      } catch { /* ignore */ }
      // Vzorové inzeráty — primárne z DB (cross-device), fallback localStorage
      try {
        if (uid) {
          const { data } = await supabase.from("users").select("vzorove_inzeraty").eq("id", uid).single();
          const dbVal = data?.vzorove_inzeraty;
          if (Array.isArray(dbVal) && dbVal.length > 0) {
            vzorovyInzerat = dbVal.filter(Boolean).join("\n");
          }
        }
        if (!vzorovyInzerat) {
          const vi = getUserItem(uid, "vzorove_inzeraty");
          if (vi) {
            const links = JSON.parse(vi) as string[];
            vzorovyInzerat = links.filter(Boolean).join("\n");
          }
        }
      } catch { /* ignore */ }

      const extrasArr = [
        f.balkon && "balkón", f.loggia && "loggia", f.terasa && "terasa",
        f.garaz && "garáž", f.pivnica && "pivnica",
      ].filter(Boolean) as string[];
      const res = await globalThis.fetch("/api/ai-writer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nazov: `${f.typ} ${[f.obec, f.okres].filter(Boolean).join(", ")}`.trim(),
          typ: f.typ, lokalita: lokalitaFull,
          obec: f.obec, okres: f.okres, ulica: f.ulica_verejna,
          cena: Number(f.cena) || 0, plocha: Number(f.plocha) || null,
          uzitkovaPlocha: Number(f.uzitkova_plocha) || null,
          podlahovaPlocha: Number(f.podlahova_plocha) || null,
          celkovaPlocha: Number(f.celkova_plocha) || null,
          zastavanaPlocha: Number(f.zastavana_plocha) || null,
          extras: extrasArr,
          izby: Number(f.typ.match(/(\d+)-izb/)?.[1] || f.izby) || null, stav: f.stav, popis: ctx,
          // typCeny: "predaj" (default) alebo "prenajom" — určuje či sa aplikuje Baťovská
          typCeny: /prenaj/i.test(f.typ_ceny || f.kategoria || "") ? "prenajom" : "predaj",
          photos: photoB64,
          maklerMeno, maklerTelefon, maklerEmail, vzorovyInzerat,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Čistenie textu — Claude niekedy napriek zákazu pridá SEP_SEO/SEP_TAGS blok.
      // Podporujeme 3 varianty: "SEP_SEO [...]", "SEP_SEO\n...", alebo na konci bez zátvorky.
      const rawText = data.emotivny || data.technicky || "";
      const extractBlock = (marker: string): string | null => {
        // Format 1: "SEP_SEO [ content ]"
        const brackets = rawText.match(new RegExp(`${marker}\\s*\\[([^\\]]+)\\]`));
        if (brackets) return brackets[1].trim();
        // Format 2: "SEP_SEO\n content \n\n" or end of text
        const newline = rawText.match(new RegExp(`${marker}\\s*\\n([\\s\\S]+?)(?:\\n\\s*\\n|$)`));
        if (newline) return newline[1].trim();
        return null;
      };
      const seoFromText = extractBlock("SEP_SEO");
      const tagFromText = extractBlock("SEP_TAGS");

      const text = rawText
        .replace(/SEP_SEO[\s\S]*?(?=SEP_TAGS|$)/g, "")
        .replace(/SEP_TAGS[\s\S]*$/g, "")
        .trim();

      setF(prev => {
        const updates: Partial<typeof prev> = {
          nazov: data.nazov || prev.nazov,
          text_popis: text,
          intro: data.intro || data.kratky || prev.intro,
          // Preferujeme seo_keywords pole z JSON, fallback na extrahovaný blok, inak auto-generate
          seo_keywords: data.seo_keywords || seoFromText || generateSEO(prev),
          tagy: data.tagy || tagFromText || prev.tagy,
          meta_description: data.meta_description || "",
          h1: data.h1 || data.nazov || prev.nazov,
        };
        // Baťovská cena z AI
        if (data.cena_batova && data.cena_batova.trim()) {
          const cenaCislo = data.cena_batova.replace(/[^\d]/g, "");
          if (cenaCislo) updates.cena = cenaCislo;
        }
        return { ...prev, ...updates };
      });
      setTimeout(() => aiRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    } catch (e) { console.error("[ai-writer] client error:", e); setError(`Generovanie zlyhalo: ${String((e as Error)?.message || e).slice(0,800)}`); }
    setGenerating(false);
  }

  /* Auto-generate SEO keywords from form data */
  function generateSEO(form: typeof defaultForm): string {
    const parts: string[] = [];
    if (form.typ) parts.push(form.typ.replace(/-/g, " "));
    if (form.kategoria) parts.push(form.kategoria.replace(/-/g, " "));
    if (form.obec) parts.push(form.obec);
    if (form.okres) parts.push(form.okres);
    if (form.izby) parts.push(`${form.izby} izbový`);
    if (form.plocha) parts.push(`${form.plocha} m2`);
    if (form.stav) parts.push(form.stav);
    parts.push("nehnuteľnosť", "reality", "slovensko");
    return parts.filter(Boolean).join(", ");
  }

  async function handleRefine(instruction: string) {
    const msg = (instruction || chatInput).trim();
    if (!msg) return;
    setChatInput(""); setGenerating(true);
    try {
      // Konvertuj fotky aj pri refine (aby AI videlo fotky)
      const photoB64: string[] = [];
      for (const p of photos.slice(0, 5)) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = p.url; });
          const canvas = document.createElement("canvas");
          const maxW = 800;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctxC = canvas.getContext("2d");
          ctxC?.drawImage(img, 0, 0, canvas.width, canvas.height);
          photoB64.push(canvas.toDataURL("image/jpeg", 0.7));
        } catch { /* skip */ }
      }

      // Load makler profile for refine too (per-user)
      let rMeno = "", rTel = "", rEmail = "";
      try {
        const mp = getUserItem(uid, "makler_profile");
        if (mp) { const p = JSON.parse(mp); rMeno = p.meno || ""; rTel = p.telefon || ""; rEmail = p.email || ""; }
      } catch { /* ignore */ }

      const extrasArr = [
        f.balkon && "balkón", f.loggia && "loggia", f.terasa && "terasa",
        f.garaz && "garáž", f.pivnica && "pivnica",
      ].filter(Boolean) as string[];
      const res = await globalThis.fetch("/api/ai-writer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nazov: f.nazov || "Úprava", typ: f.typ,
          lokalita: [f.ulica_verejna, f.obec, f.okres, f.kraj].filter(Boolean).join(", "),
          obec: f.obec, okres: f.okres, ulica: f.ulica_verejna,
          cena: Number(f.cena) || 0, plocha: Number(f.plocha) || null,
          uzitkovaPlocha: Number(f.uzitkova_plocha) || null,
          podlahovaPlocha: Number(f.podlahova_plocha) || null,
          celkovaPlocha: Number(f.celkova_plocha) || null,
          zastavanaPlocha: Number(f.zastavana_plocha) || null,
          extras: extrasArr,
          izby: Number(f.izby) || null, stav: f.stav,
          popis: `${buildContext()}\n\nPožiadavka: ${msg}\n\nAktuálny text:\n${f.text_popis}`,
          photos: photoB64,
          maklerMeno: rMeno, maklerTelefon: rTel, maklerEmail: rEmail,
        }),
      });
      const data = await res.json();
      const text = (data.emotivny || data.technicky || "").replace(/SEP_SEO\s*\[[^\]]*\]/g, "").replace(/SEP_TAGS\s*\[[^\]]*\]/g, "").trim();
      if (text) setF(prev => ({ ...prev, text_popis: text }));
    } catch { setError("Úprava zlyhala."); }
    setGenerating(false);
  }

  async function handleSave(publish: boolean) {
    console.log("[inzerat save] entered, publish=", publish, "photos=", photos.length, "cena=", f.cena);
    try {
    if (!f.cena) { setError("Cena je povinná"); return; }
    // Fotka je "ešte nenahraná" iba ak uploading: true A zároveň nemá path (Storage cesta).
    // Ak path existuje, upload prešiel do Supabase bez ohľadu na zaseknutý flag.
    const stillUploading = photos.filter(p => p.uploading && !p.path);
    if (stillUploading.length > 0) {
      const readyCount = photos.length - stillUploading.length;
      if (readyCount === 0) {
        setError("Počkaj, fotky sa ešte nahrávajú…");
        return;
      }
      console.warn(`[inzerat save] ${stillUploading.length} fotiek ešte nahráva, pokračujem s ${readyCount} hotovými`);
    }
    setSaving(true); setError("");

    const uploadedPhotos = photos.filter(p => p.path && p.url && !p.error);

    const payload = {
      fotky_urls: uploadedPhotos.map(p => p.url),
      fotky_thumbs: uploadedPhotos.map(p => p.thumb || p.url),
      videa_urls: videos,
      nazov: f.nazov.trim(), typ: f.typ,
      lokalita: [f.obec, f.okres, f.kraj].filter(Boolean).join(", ") || f.lokalita,
      cena: Number(f.cena), plocha: f.plocha ? Number(f.plocha) : null,
      izby: f.izby ? Number(f.izby) : null, poschodie: f.poschodie ? Number(f.poschodie) : null,
      stav: (f.stav || null) as StavNehnutelnosti | null,
      url_inzercia: f.url_inzercia || null,
      intro: f.intro || null, text_popis: f.text_popis || null,
      zobrazovat_cenu: f.zobrazovat_cenu, zobrazovat_mapu: f.zobrazovat_mapu,
      zobrazovat_hypoteku: f.zobrazovat_hypoteku, so_zmluvou: f.so_zmluvou,
      projekt: f.projekt, specialne_oznacenie: f.specialne_oznacenie || null,
      seo_keywords: f.seo_keywords || null, stat: f.stat, kraj: f.kraj || null,
      okres: f.okres || null, obec: f.obec || null,
      ulica_privatna: f.ulica_privatna || null, makler: f.makler || null,
      interne_id: f.interne_id || null,
      provizia_hodnota: f.provizia_hodnota ? Number(f.provizia_hodnota) : null,
      provizia_typ: f.provizia_typ, poznamka_interna: f.poznamka_interna || null,
      orientacia: f.orientacia || null, pripojenie: f.pripojenie,
      typ_ceny: f.typ_ceny || null, tagy: f.tagy || null,
      vlastnictvo: f.vlastnictvo || null, text_k_cene: f.text_k_cene || null,
      cena_za_energie: f.cena_za_energie || null, exkluzivne: f.exkluzivne,
      url_virtualka: f.url_virtualka || null, vhodne_pre_studentov: f.vhodne_pre_studentov,
      video_url: f.video_url || null, kategoria: f.kategoria || null,
      // Export na portály ešte nie je zapojený — ukladáme vždy prázdny objekt.
      // Keď budeme mať integráciu (Nehnutelnosti.sk, TopReality atď.),
      // separátne tlačidlo spustí export.
      export_portaly: {},
      // Linking + status
      klient_id: klientId || null,
      // Makler inzerátu = ten kto je v f.makler (preberá sa z náberového
      // listu), NIE prihlásený user. Toto rozhoduje pre portfolio filter.
      // Lookup UUID + email cez maklerList (z `makleri` tabuľky).
      ...(() => {
        const m = maklerList.find(x => x.meno === f.makler);
        if (m) return { makler_id: m.id, makler_email: m.email || null };
        // Fallback: makler cez email prihláseného usera. `makler_id` musí byť
        // UUID z tabuľky makleri — ak nenájdeme, nechaj null (nie user.id reťazec,
        // ktorý by zhodil insert kvôli UUID type constraint).
        const byEmail = maklerList.find(x => x.email === authUser?.email)?.id || null;
        return {
          makler_id: byEmail,
          makler_email: authUser?.email || null,
        };
      })(),
      status: publish ? "aktivny" : "koncept",
    };

    console.log("[inzerat save] payload keys:", Object.keys(payload).join(","), "editId=", editId);
    // Save cez server-side API (service_role — obchádza RLS)
    const res = await globalThis.fetch("/api/inzerat/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, editId }),
    });
    const out = await res.json().catch(() => ({ error: "Neplatná odpoveď servera" }));
    console.log("[inzerat save] API result:", res.status, out);
    const err = res.ok ? null : { message: out.error || `HTTP ${res.status}`, code: out.code, details: out.details };

    setSaving(false);
    if (err) {
      console.error("[inzerat save] failed:", err);
      const msg = err.message || JSON.stringify(err).slice(0, 200) || "Uloženie zlyhalo. Skontroluj konzolu.";
      setError(msg);
      if (typeof window !== "undefined") window.alert("⚠️ Uloženie zlyhalo: " + msg);
      return;
    }
    if (draftKey && typeof window !== "undefined") {
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    }
    setSaved(true); setTimeout(() => setSaved(false), 3000);
    if (typeof window !== "undefined") window.alert("✓ Inzerát uložený do portfólia");
    if (publish) { setF(defaultForm); onSaved?.(); }
    } catch (e) {
      console.error("[inzerat save] uncaught exception:", e);
      setSaving(false);
      const msg = (e as Error)?.message || String(e).slice(0, 200);
      setError("Chyba: " + msg);
      if (typeof window !== "undefined") window.alert("⚠️ Chyba pri ukladaní: " + msg);
    }
  }

  const hasContent = photos.length > 0 || f.lv_text || docs.length > 0;
  const canGenerate = !!(f.typ || f.obec || f.lv_text);
  const allPortals = PORTALY.every(p => f.export_portaly[p.key]);

  return (
    <div style={{ maxWidth: "960px" }} onDragOver={e => e.preventDefault()} onDrop={e => e.preventDefault()}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: "700", color: "#374151", letterSpacing: "-0.03em" }}>Nový inzerát</h1>
        <p style={{ fontSize: "14px", color: "#9CA3AF", marginTop: "4px" }}>Nahraj súbory, skontroluj údaje a publikuj</p>
      </div>

      {/* ═══ NÁBERÁK FALLBACK INFO ═══ */}
      {naberakFilledFields.length > 0 && (
        <div style={{
          padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
          background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)",
          display: "flex", alignItems: "center", gap: "10px", fontSize: "12px",
          color: "var(--text-primary)",
        }}>
          <span style={{ fontSize: "14px" }}>📋</span>
          <span>
            Z <strong>náberového listu</strong> doplnené {naberakFilledFields.length} {naberakFilledFields.length === 1 ? "pole" : naberakFilledFields.length < 5 ? "polia" : "polí"}
            <span style={{ color: "var(--text-tertiary)", marginLeft: "8px" }}>({naberakFilledFields.slice(0, 8).join(", ")}{naberakFilledFields.length > 8 ? "…" : ""})</span>
          </span>
          <button onClick={() => setNaberakFilledFields([])} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px" }}>×</button>
        </div>
      )}

      {/* ═══ GLOBAL PROGRESS ═══ */}
      <Progress active={!!uploadingFile} text={`Nahrávam ${uploadingFile}...`} />
      <Progress active={parsingLV && !uploadingFile} text="AI analyzuje List vlastníctva..." />
      <Progress active={processingDoc >= 0} text={`AI analyzuje dokument ${processingDoc >= 0 ? docs[processingDoc]?.name : ""}...`} />

      {/* ═══ DROP ZONE ═══ */}
      <div ref={dropRef}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDropOver(true); }}
        onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDropOver(true); }}
        onDragLeave={e => { e.preventDefault(); e.stopPropagation(); if (!dropRef.current?.contains(e.relatedTarget as Node)) setDropOver(false); }}
        onDrop={handleDrop}
        style={{ ...s.card, padding: 0, overflow: "hidden", border: dropOver ? "2px solid #3B82F6" : "2px dashed var(--border)", background: dropOver ? "var(--bg-elevated)" : "var(--bg-surface)", transition: "all 0.2s" }}>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }}
          onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />

        {!hasContent ? (
          <div onClick={() => fileRef.current?.click()} style={{ padding: "48px 24px", textAlign: "center", cursor: "pointer" }}>
            {dropOver
              ? <><div style={{ fontSize: "32px", marginBottom: "8px" }}>⬇️</div><div style={{ fontSize: "16px", fontWeight: "600", color: "#3B82F6" }}>Pusť súbory sem</div></>
              : <><div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "#F3F4F6", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>+</div><div style={{ fontSize: "15px", fontWeight: "600", color: "#374151" }}>Klikni alebo pretiahni súbory</div><div style={{ fontSize: "13px", color: "#9CA3AF", marginTop: "6px" }}>Fotky · List vlastníctva · Zmluvy — systém roztriedí automaticky</div></>}
          </div>
        ) : (
          <div style={{ padding: "20px" }}>
            {photos.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Fotky ({photos.length})</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Ťahaj pre zmenu poradia · prvá = titulná</div>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {photos.map((p, idx) => (
                    <div key={p.id}
                      draggable={!p.uploading}
                      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); }}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                      onDrop={e => {
                        e.preventDefault();
                        const draggedId = e.dataTransfer.getData("text/plain");
                        if (!draggedId || draggedId === p.id) return;
                        setPhotos(prev => {
                          const from = prev.findIndex(x => x.id === draggedId);
                          const to = prev.findIndex(x => x.id === p.id);
                          if (from < 0 || to < 0) return prev;
                          const next = [...prev];
                          const [moved] = next.splice(from, 1);
                          next.splice(to, 0, moved);
                          return next;
                        });
                      }}
                      style={{ width: "96px", height: "96px", borderRadius: "10px", overflow: "hidden", position: "relative", background: "#F3F4F6", cursor: p.uploading ? "default" : "grab", border: idx === 0 ? "2px solid #3B82F6" : "2px solid transparent" }}>
                      <img src={p.thumb || p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: p.uploading ? 0.5 : 1, pointerEvents: "none" }} />
                      {idx === 0 && !p.uploading && !p.error && (
                        <div style={{ position: "absolute", bottom: "3px", left: "3px", padding: "2px 6px", borderRadius: "6px", background: "#3B82F6", color: "#fff", fontSize: "9px", fontWeight: "700", letterSpacing: "0.03em" }}>TITULNÁ</div>
                      )}
                      {idx > 0 && !p.uploading && (
                        <button onClick={() => setPhotos(prev => { const next = [...prev]; const [moved] = next.splice(idx, 1); next.unshift(moved); return next; })}
                          title="Nastaviť ako titulnú"
                          style={{ position: "absolute", bottom: "3px", left: "3px", padding: "2px 6px", borderRadius: "6px", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "9px", fontWeight: "600", cursor: "pointer" }}>★ titulnú</button>
                      )}
                      {p.uploading && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#fff", background: "rgba(0,0,0,0.3)" }}>…</div>
                      )}
                      {p.error && (
                        <div title={p.error} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#fff", background: "rgba(239,68,68,0.7)" }}>✕</div>
                      )}
                      <button onClick={() => {
                        if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
                        if (p.path) deleteFoto(p.path).catch(() => {});
                        setPhotos(prev => prev.filter(x => x.id !== p.id));
                      }}
                        style={{ position: "absolute", top: "3px", right: "3px", width: "20px", height: "20px", borderRadius: "10px", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {photos.some(p => p.uploading) && (
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "10px" }}>
                Fotky sa nahrávajú na server…
              </div>
            )}
            {f.lv_text && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  List vlastníctva {lvParsed && <span style={{ color: "#10B981" }}>✓</span>}
                </div>
                {lvParsed && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                    {Object.entries(lvParsed).map(([k, v]) => (
                      <span key={k} style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", background: "#F3F4F6", color: "#374151" }}>{k}: <strong>{v}</strong></span>
                    ))}
                  </div>
                )}
                <details><summary style={{ fontSize: "11px", color: "#9CA3AF", cursor: "pointer" }}>Zobraziť LV text</summary>
                  <textarea style={{ ...s.input, marginTop: "6px", minHeight: "60px", resize: "vertical", fontSize: "12px" }} value={f.lv_text} onChange={e => set("lv_text", e.target.value)} />
                </details>
              </div>
            )}
            {docs.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Dokumenty ({docs.length})</div>
                {docs.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "8px", background: "#F9FAFB", fontSize: "12px", marginBottom: "4px" }}>
                    <span>📄</span><span style={{ flex: 1 }}>{d.name}</span><span style={{ color: "#9CA3AF" }}>{(d.size / 1024).toFixed(0)} KB</span>
                    {(d.text || d.pdf_base64) && (
                      <button onClick={() => handleProcessDoc(i)} disabled={processingDoc === i}
                        style={{ padding: "3px 10px", borderRadius: "6px", border: "1px solid #3B82F6", background: processingDoc === i ? "#EFF6FF" : "#fff", color: "#3B82F6", fontSize: "11px", fontWeight: "500", cursor: processingDoc === i ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                        {processingDoc === i ? "Analyzujem..." : d.type?.includes("✓") ? "🔄 Znova" : "⚡ AI"}
                      </button>
                    )}
                    <button onClick={() => setDocs(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1.5px dashed var(--border)", background: "transparent", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>+ Pridať súbory</button>
            {docs.some(d => d.text) && (
              <div style={{ marginTop: "12px" }}>
                <input style={{ ...s.input, fontSize: "12px" }} placeholder="🔍 Hľadať v dokumentoch (napr. balkón, IBAN, parcela…)" value={docQuery} onChange={e => setDocQuery(e.target.value)} />
                {docHits.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {docHits.map((h, i) => (
                      <div key={i} style={{ padding: "8px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--text-primary)" }}>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px" }}>{h.doc}</div>
                        {h.snippet}
                      </div>
                    ))}
                  </div>
                )}
                {docQuery.trim().length >= 2 && docHits.length === 0 && (
                  <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--text-muted)" }}>Žiadne výsledky v nahratých dokumentoch.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ VIDEÁ & 3D OBHLIADKA ═══ */}
      <div style={{ ...s.card, padding: "16px 20px" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "10px" }}>Videá a 3D obhliadka</div>
        {videos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
            {videos.map((v, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", background: "var(--bg-elevated)", fontSize: "12px" }}>
                <span>🎬</span>
                <span style={{ flex: 1, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                <button onClick={() => setVideos(prev => prev.filter((_, j) => j !== i))}
                  style={{ width: "20px", height: "20px", borderRadius: "10px", border: "none", background: "rgba(0,0,0,0.1)", cursor: "pointer", fontSize: "11px", color: "var(--text-primary)" }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <input
            placeholder="🎬 YouTube / Vimeo link (Enter)"
            value={videoInput}
            onChange={e => setVideoInput(e.target.value)}
            onKeyDown={e => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const n = normalizeVideoUrl(videoInput);
              if (n) { setVideos(prev => [...prev, n]); setVideoInput(""); }
              else setError("Neplatný YouTube/Vimeo link.");
            }}
            style={{ ...s.input, fontSize: "12px", padding: "8px 12px" }}
          />
          <input
            placeholder="🏠 Matterport / Kuula 3D link"
            value={f.url_virtualka}
            onChange={e => {
              const v = e.target.value;
              if (!v.trim()) { set("url_virtualka", ""); return; }
              const n = normalizeTour3D(v);
              set("url_virtualka", n || v);
            }}
            style={{ ...s.input, fontSize: "12px", padding: "8px 12px" }}
          />
        </div>
      </div>

      {/* Ctrl+V LV */}
      {!f.lv_text && (
        <div style={{ ...s.card, padding: "14px 20px" }}>
          <textarea style={{ ...s.input, minHeight: "56px", resize: "none", fontSize: "13px" }}
            placeholder="Alebo vlož text z LV priamo sem (Ctrl+V)..."
            value={f.lv_text} onChange={e => set("lv_text", e.target.value)}
            onPaste={e => { const t = e.clipboardData.getData("text"); if (t.trim().length > 30) setTimeout(() => handleParseLV(t), 100); }} />
        </div>
      )}

      {/* ═══ MAIN GRID ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "12px", alignItems: "start" }}>
        <div>
          {/* Kategória */}
          <div style={s.card}>
            <div style={s.g2}>
              <div>
                <label style={s.label}>Kategória</label>
                <select style={s.select} value={f.typ} onChange={e => set("typ", e.target.value)}>
                  <option value="">— vyberte —</option>
                  <optgroup label="Byty"><option value="garsonka">Garsónka</option><option value="dvojgarsonka">Dvojgarsónka</option><option value="1-izbovy-byt">1-izbový byt</option><option value="2-izbovy-byt">2-izbový byt</option><option value="3-izbovy-byt">3-izbový byt</option><option value="4-izbovy-byt">4-izbový byt</option><option value="5-izbovy-byt">5 a viac izbový byt</option><option value="loft">Loft</option><option value="mezonet">Mezonet</option><option value="apartman">Rekreačný apartmán</option></optgroup>
                  <optgroup label="Domy"><option value="rodinny-dom">Rodinný dom</option><option value="chata">Chata</option><option value="vidiecky-dom">Vidiecky dom</option><option value="farmarska-usadlost">Farmárska usadlosť</option><option value="mobilny-dom">Mobilný dom</option><option value="hausbot">Hausbót</option><option value="zrub">Zrub</option><option value="zahradny-domcek">Záhradný domček</option></optgroup>
                  <optgroup label="Pozemky"><option value="pozemok-rd">Pre rodinné domy</option><option value="polnohospodarska-poda">Poľnohospodárska pôda</option><option value="zahrada">Záhrada</option><option value="komercna-zona">Komerčná zóna</option><option value="vinice">Vinice</option><option value="pozemok-rekreacia">Na rekreáciu</option><option value="pozemok-vystavba">Na výstavbu</option><option value="stavebny-pozemok">Stavebný pozemok</option><option value="pozemok-obcianska">Občianska vybavenosť</option><option value="priemyselna-zona">Priemyselná zóna</option><option value="zmiesana-zona">Zmiešaná zóna</option><option value="sad">Sad</option><option value="luky-pasienky">Lúky a pasienky</option><option value="orna-poda">Orná pôda</option><option value="les">Les</option><option value="jazero">Jazero</option></optgroup>
                  <optgroup label="Objekty"><option value="komercny-objekt">Komerčný objekt</option><option value="vyrobne-zariadenie">Výrobné zariadenie</option><option value="kancelarie">Kancelárie</option><option value="restauracia">Reštaurácia</option><option value="sklad">Sklad</option><option value="hotel-penzion">Hotel - penzión</option><option value="polyfunkcna-budova">Polyfunkčná budova</option><option value="servisne-zariadenie">Servisné zariadenie</option><option value="chov-zvierat">Chov zvierat</option><option value="kupele">Kúpele</option><option value="historicky-objekt">Historický objekt</option><option value="sportovy-objekt">Športový objekt</option><option value="mala-elektraren">Malá elektráreň</option><option value="pumpa">Pumpa</option></optgroup>
                </select>
              </div>
              <div>
                <label style={s.label}>Typ ponuky</label>
                <select style={s.select} value={f.kategoria} onChange={e => set("kategoria", e.target.value)}>
                  <option value="">— vyberte —</option>
                  <optgroup label="Predaj"><option value="na-predaj">NA PREDAJ!</option><option value="pripravujeme-predaj">PRIPRAVUJEME na predaj</option><option value="iba-u-nas-predaj">IBA U NÁS! (predaj)</option></optgroup>
                  <optgroup label="Nájom"><option value="na-najom">NA NÁJOM!</option><option value="pripravujeme-najom">PRIPRAVUJEME na nájom</option><option value="iba-u-nas-najom">IBA U NÁS! (nájom)</option></optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Základné údaje */}
          <div style={s.card}>
            <div style={s.title}>Základné údaje</div>
            {f.nazov && (
              <div style={{ marginBottom: "14px", padding: "8px 12px", background: "#F0F9FF", borderRadius: "8px", fontSize: "13px" }}>
                <span style={{ color: "#3B82F6", fontWeight: "500" }}>Názov:</span> {f.nazov}
              </div>
            )}
            <div style={{ ...s.g2, marginBottom: "12px" }}>
              <div>
                <label style={s.label}>Cena (€)</label>
                <input style={s.input} type="number" placeholder="150 000" value={f.cena}
                  onChange={e => set("cena", e.target.value)}
                  onBlur={e => { const b = toBataCena(e.target.value); if (b !== e.target.value && b !== "NaN") set("cena", b); }} />
              </div>
              <div><label style={s.label}>Výmera (m²)</label><input style={s.input} type="number" placeholder="65" value={f.plocha} onChange={e => set("plocha", e.target.value)} /></div>
            </div>
            <div style={s.g2}>
              <div><label style={s.label}>Maklér</label><select style={s.select} value={f.makler} onChange={e => set("makler", e.target.value)}>
                {(() => {
                  const names = maklerList.map(m => m.meno);
                  const list = names.includes(f.makler) ? names : [f.makler, ...names];
                  return list.filter(Boolean).map(m => <option key={m} value={m}>{m}</option>);
                })()}
              </select></div>
              <div><label style={s.label}>Interné ID</label><input style={s.input} value={f.interne_id} onChange={e => set("interne_id", e.target.value)} /></div>
            </div>
          </div>

          {/* Rozšírené vlastnosti */}
          <div style={s.card}>
            <div style={s.title}>Rozšírené vlastnosti</div>
            <div style={{ ...s.g2, marginBottom: "12px" }}>
              <div><label style={s.label}>Úžitková plocha (m²)</label><input style={s.input} type="number" value={f.uzitkova_plocha} onChange={e => set("uzitkova_plocha", e.target.value)} /></div>
              <div><label style={s.label}>Zastavaná plocha (m²)</label><input style={s.input} type="number" value={f.zastavana_plocha} onChange={e => set("zastavana_plocha", e.target.value)} /></div>
            </div>
            <div style={{ ...s.g2, marginBottom: "12px" }}>
              <div><label style={s.label}>Podlahová plocha (m²)</label><input style={s.input} type="number" value={f.podlahova_plocha} onChange={e => set("podlahova_plocha", e.target.value)} /></div>
              <div><label style={s.label}>Skladová plocha (m²)</label><input style={s.input} type="number" value={f.skladova_plocha} onChange={e => set("skladova_plocha", e.target.value)} /></div>
            </div>
            <div style={{ ...s.g2, marginBottom: "12px" }}>
              <div><label style={s.label}>Stav</label>
                <select style={s.select} value={f.stav} onChange={e => set("stav", e.target.value)}>
                  <option value="">—</option>
                  <option value="novostavba">Novostavba</option>
                  <option value="kompletna-rekonstrukcia">Kompletná rekonštrukcia</option>
                  <option value="uplne-prerobeny">Úplne prerobený</option>
                  <option value="ciastocne-prerobeny">Čiastočne prerobený</option>
                  <option value="povodny-stav">Pôvodný stav</option>
                  <option value="vo-faze-projektovania">Vo fáze projektovania</option>
                  <option value="vo-vystavbe">Vo výstavbe</option>
                  <option value="urcene-na-demolaciu">Určené na demoláciu</option>
                </select>
              </div>
              <div><label style={s.label}>Energetický certifikát</label>
                <select style={s.select} value={f.energeticky_certifikat} onChange={e => set("energeticky_certifikat", e.target.value)}>
                  <option value="">—</option>{["A0","A1","A","B","C","D","E","F","G"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ ...s.g2, marginBottom: "12px" }}>
              <div><label style={s.label}>Typ budovy</label>
                <select style={s.select} value={f.typ_budovy} onChange={e => set("typ_budovy", e.target.value)}>
                  <option value="">—</option>
                  <option value="panelova">Panelová</option><option value="tehlova">Tehlová</option>
                  <option value="zmiešaná">Zmiešaná</option><option value="montovana">Montovaná</option>
                  <option value="drevena">Drevená</option><option value="ina">Iná</option>
                </select>
              </div>
              <div><label style={s.label}>Typ výbavy</label>
                <select style={s.select} value={f.typ_vybavy} onChange={e => set("typ_vybavy", e.target.value)}>
                  <option value="">—</option>
                  <option value="uplne-zariadeny">Úplne zariadený</option>
                  <option value="ciastocne-zariadeny">Čiastočne zariadený</option>
                  <option value="nezariadeny">Nezariadený</option>
                </select>
              </div>
            </div>
          </div>

          {/* Priestory */}
          <div style={s.card}>
            <div style={s.title}>Priestory</div>

            {/* Poschodia */}
            <div style={{ ...s.g2, marginBottom: "10px" }}>
              <div><label style={s.label}>Poschodie bytu</label><input style={s.input} type="number" value={f.poschodie} onChange={e => set("poschodie", e.target.value)} placeholder="napr. 3" /></div>
              <div><label style={s.label}>Pozícia bytu</label>
                <select style={s.select} value={f.pozicia} onChange={e => set("pozicia", e.target.value)}>
                  <option value="">—</option><option value="vyssie-poschodie">Vyššie poschodie</option><option value="stredne-poschodie">Stredné poschodie</option><option value="nizsie-poschodie">Nižšie poschodie</option><option value="prizemia">Prízemie</option><option value="suteren">Suterén</option><option value="mezonet">Mezonet</option>
                </select>
              </div>
              <div><label style={s.label}>Celkom poschodí v budove</label><input style={s.input} type="number" value={f.poschodia_vyssie} onChange={e => set("poschodia_vyssie", e.target.value)} placeholder="napr. 8" /></div>
              <div><label style={s.label}>Podzemné podlažia</label><input style={s.input} type="number" value={f.poschodia_nizsie} onChange={e => set("poschodia_nizsie", e.target.value)} placeholder="napr. 1" /></div>
            </div>

            {/* Vybavenie — všetko v jednom prehľadnom gride */}
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginTop: "14px", marginBottom: "8px" }}>Vybavenie</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {([
                ["balkon","Balkón"],["loggia","Loggia"],["terasa","Terasa"],
                ["vytah","Výťah"],["garaz","Garáž"],["pivnica","Pivnica"],
                ["spajza","Špajza"],["sklad_toggle","Sklad"],["dielna","Dielňa"],
                ["verejne_parkovanie","Verejné parkovanie"],["sukromne_parkovanie","Súkromné parkovanie"],
              ] as [string,string][]).map(([k,l]) => (
                <Tog key={k} on={(f as Record<string, unknown>)[k] as boolean} set={v => set(k, v)} label={l} />
              ))}
            </div>
          </div>

          {/* Roky + poschodia */}
          <div style={s.card}>
            <div style={s.title}>História budovy</div>
            <div style={{ ...s.g3, marginBottom: "12px" }}>
              <div><label style={s.label}>Rok výstavby</label><input style={s.input} type="number" placeholder="1985" value={f.rok_vystavby} onChange={e => set("rok_vystavby", e.target.value)} /></div>
              <div><label style={s.label}>Rok rekonštrukcie</label><input style={s.input} type="number" value={f.rok_rekonstrukcie} onChange={e => set("rok_rekonstrukcie", e.target.value)} /></div>
              <div><label style={s.label}>Rok kolaudácie</label><input style={s.input} type="number" value={f.rok_kolaudacie} onChange={e => set("rok_kolaudacie", e.target.value)} /></div>
            </div>
          </div>

          {/* Vykurovanie */}
          <div style={s.card}>
            <div style={s.title}>Vykurovanie a klimatizácia</div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "8px" }}>Typ vykurovania</div>
            <div style={s.g3}>
              {[["centralne","Centrálne"],["podlahove","Podlahové"],["lokalne","Lokálne"],["kozub","Kozub / krb"]].map(([k,l]) => (
                <Tog key={k} on={f.vykurovanie[k] ?? false} set={v => setVyk(k, v)} label={l} />
              ))}
            </div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginTop: "12px", marginBottom: "8px" }}>Klimatizácia a ostatné</div>
            <div style={s.g3}>
              {[["klimatizacia","Klimatizácia"],["emitory","Emitory / radiátory"],["ine","Iné"]].map(([k,l]) => (
                <Tog key={k} on={f.vykurovanie[k] ?? false} set={v => setVyk(k, v)} label={l} />
              ))}
            </div>
          </div>

          {/* Ďalšie vlastnosti */}
          <div style={s.card}>
            <div style={s.title}>Ďalšie vlastnosti</div>
            <div style={{ ...s.g2, marginBottom: "12px" }}>
              <div><label style={s.label}>Orientácia</label>
                <select style={s.select} value={f.orientacia} onChange={e => set("orientacia", e.target.value)}>
                  <option value="">—</option><option value="S">Sever</option><option value="J">Juh</option><option value="V">Východ</option><option value="Z">Západ</option><option value="SV">SV</option><option value="SZ">SZ</option><option value="JV">JV</option><option value="JZ">JZ</option>
                </select>
              </div>
              <Tog on={f.inzinierske_siete} set={v => set("inzinierske_siete", v)} label="Inžinierske siete" />
            </div>
            <div style={{ fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "8px" }}>Komunikačné pripojenie</div>
            <div style={s.g3}>
              {[["telefon","Telefón"],["internet","Internet"],["satelit","Satelit"],["kablova_tv","Káblová TV"],["opticka_siet","Optická sieť"],["ine","Iné"]].map(([k,l]) => (
                <Tog key={k} on={f.pripojenie[k] ?? false} set={v => setPr(k, v)} label={l} />
              ))}
            </div>
          </div>

          {/* 💶 Mesačné náklady */}
          <div style={s.card}>
            <div style={s.title}>Mesačné náklady</div>
            <div style={{ ...s.g2, marginBottom: "12px" }}>
              <div><label style={s.label}>Náklady celkom (€/mes)</label><input style={s.input} type="number" placeholder="250" value={f.mesacne_naklady} onChange={e => set("mesacne_naklady", e.target.value)} /></div>
              <div><label style={s.label}>Cena za energie (€/mes)</label><input style={s.input} type="number" value={f.cena_za_energie} onChange={e => set("cena_za_energie", e.target.value)} /></div>
            </div>
            {f.naklady_detail && (
              <div style={{ padding: "8px 12px", background: "#F0F9FF", borderRadius: "8px", fontSize: "12px", color: "#1D4ED8" }}>
                <span style={{ fontWeight: "600" }}>Rozpis:</span> {f.naklady_detail}
              </div>
            )}
          </div>

          {/* ⚠️ Právne vady */}
          {f.pravne_vady && (
            <div style={{ ...s.card, borderLeft: "3px solid #F59E0B" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#D97706", marginBottom: "8px" }}>⚠ Právne vady a ťarchy</div>
              <textarea style={{ ...s.input, resize: "vertical", minHeight: "60px", fontSize: "13px" }} value={f.pravne_vady} onChange={e => set("pravne_vady", e.target.value)} />
            </div>
          )}


          {/* ═══ AI WRITER — NA SPODKU ═══ */}
          <div ref={aiRef} style={{
            ...s.card, padding: 0, overflow: "hidden",
            background: generating ? "var(--bg-elevated)" : "var(--bg-surface)", transition: "background 0.3s",
          }}>
            <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: f.text_popis ? "1px solid #E5E7EB" : "none" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  AI Writer
                  {generating && <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "500", color: "#3B82F6", background: "rgba(59,130,246,0.12)", padding: "2px 10px", borderRadius: "10px" }}><span style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#3B82F6", animation: "pulse 1s ease-in-out infinite" }} />{f.text_popis ? FUNNY_MSGS[refineMsgIdx] : "Generujem..."}</span>}
                </div>
                {(() => {
                  const rawLok = [f.lokalita, f.obec, f.ulica_verejna, f.okres].filter(Boolean).join(", ");
                  const seen = new Set<string>();
                  const lokalita = rawLok.split(",").map(s => s.trim()).filter(Boolean).filter(p => {
                    const k = p.toLowerCase();
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                  }).join(", ");
                  const extras = [f.balkon && "balkón", f.loggia && "loggia", f.terasa && "terasa", f.garaz && "garáž", f.pivnica && "pivnica"].filter(Boolean) as string[];
                  const izby = f.izby ? `${f.izby}${extras.length ? " + " + extras.join(", ") : ""}` : "";
                  const plochaVal = f.plocha || f.uzitkova_plocha || f.podlahova_plocha || f.celkova_plocha || f.zastavana_plocha;
                  const vymera = plochaVal ? `${plochaVal} m²` : "";
                  const cena = f.cena ? `${Number(String(f.cena).replace(/\s/g, "")).toLocaleString("sk-SK")} €` : "";
                  const rows = [["Lokalita", lokalita], ["Izby", izby], ["Výmera", vymera], ["Financie", cena]].filter(([, v]) => v);
                  if (!rows.length) return <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "2px" }}>Vyplň údaje vyššie</div>;
                  return (
                    <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px" }}>
                      {rows.map(([k, v]) => (
                        <React.Fragment key={k}>
                          <span style={{ fontWeight: "500", color: "var(--text-secondary)" }}>{k}</span>
                          <span style={{ color: "var(--text-primary)" }}>{v}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <button onClick={handleGenerate} disabled={generating || !canGenerate}
                style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: generating ? "transparent" : "var(--text-primary)", color: generating ? "transparent" : "var(--bg-base)", fontSize: "12px", fontWeight: "600", cursor: generating ? "default" : "pointer", opacity: generating ? 0 : 1 }}>
                {f.text_popis ? "Pregenerovať" : "Napísať text"}
              </button>
            </div>

            {!f.text_popis && !generating && (
              <div style={{ padding: "0 20px 16px" }}>
                <textarea style={{ ...s.input, resize: "none", height: "44px", fontSize: "13px" }}
                  placeholder="Poznámka pre AI — zariadený, nové podlahy, výhľad na Dunaj..."
                  value={f.popis} onChange={e => set("popis", e.target.value)} />
              </div>
            )}

            {generating && !f.text_popis && (
              <div style={{ padding: "32px 24px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "12px" }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#3B82F6", animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}
                </div>
                <div style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>AI píše text inzerátu</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "6px", minHeight: "16px" }}>{FUNNY_MSGS[refineMsgIdx]}</div>
              </div>
            )}

            {f.text_popis && (
              <div style={{ background: generating ? "#F9FAFB" : "transparent", transition: "background 0.3s" }}>
                <div style={{ padding: "16px 20px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={s.label}>Intro</span><span style={{ fontSize: "11px", color: "#D1D5DB" }}>{f.intro.length}/160</span>
                  </div>
                  <textarea style={{ ...s.input, resize: "none", height: "44px", fontSize: "13px", background: "var(--bg-elevated)", color: "var(--text-primary)" }} maxLength={160} value={f.intro} onChange={e => set("intro", e.target.value)} readOnly={generating} />
                </div>

                <div style={{ padding: "12px 20px 0" }}>
                  <label style={s.label}>Popis inzerátu</label>
                  <textarea style={{ ...s.input, resize: "vertical", minHeight: "180px", fontSize: "14px", lineHeight: 1.7, background: "var(--bg-elevated)", color: "var(--text-primary)" }} value={f.text_popis} onChange={e => set("text_popis", e.target.value)} readOnly={generating} />
                </div>

                <div style={{ padding: "12px 20px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[{ l: "✂ Skrátiť", c: "Skráť text" }, { l: "＋ Rozšíriť", c: "Rozšír text, pridaj detaily" }, { l: "🎩 Formálnejšie", c: "Formálnejší tón" }, { l: "😊 Priateľskejšie", c: "Priateľskejší, ľudskejší tón" }].map(a => (
                    <button key={a.l} disabled={generating} onClick={() => handleRefine(a.c)}
                      style={{ padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "500", border: "1.5px solid #E5E7EB", background: generating ? "#F3F4F6" : "#fff", color: "#374151", cursor: generating ? "default" : "pointer", opacity: generating ? 0.5 : 1 }}>{a.l}</button>
                  ))}
                </div>

                <div style={{ padding: "4px 20px 16px", display: "flex", gap: "6px" }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !generating && handleRefine("")}
                    placeholder="Uprav text — napr. pridaj výhľad, zmeň tón..."
                    style={{ ...s.input, flex: 1, fontSize: "12px", padding: "8px 12px" }} />
                  <button onClick={() => handleRefine("")} disabled={generating || !chatInput.trim()}
                    style={{ padding: "8px 14px", borderRadius: "10px", border: "none", background: chatInput.trim() ? "#374151" : "#E5E7EB", color: chatInput.trim() ? "#fff" : "#9CA3AF", fontSize: "12px", fontWeight: "600", cursor: "pointer", flexShrink: 0 }}>Upraviť</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SIDEBAR ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: "sticky", top: "80px" }}>
          {/* Zobrazenie */}
          <div style={s.card}>
            <div style={s.title}>Zobrazenie</div>
            <Tog on={f.zobrazovat_cenu} set={v => set("zobrazovat_cenu", v)} label="Cena" />
            <Tog on={f.zobrazovat_mapu} set={v => set("zobrazovat_mapu", v)} label="Mapa" />
            <Tog on={f.zobrazovat_hypoteku} set={v => set("zobrazovat_hypoteku", v)} label="Hypokalkulačka" />
            <div style={{ borderTop: "1px solid #F3F4F6", marginTop: "6px", paddingTop: "6px" }}>
              <Tog on={f.so_zmluvou} set={v => set("so_zmluvou", v)} label="So zmluvou" />
              <Tog on={f.projekt} set={v => set("projekt", v)} label="Projekt" />
            </div>
          </div>

          {/* Export — menší, v sidebar */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Portály</div>
              <button onClick={toggleAllPortals} style={{ fontSize: "11px", color: "#3B82F6", background: "none", border: "none", cursor: "pointer", fontWeight: "500" }}>
                {allPortals ? "Zrušiť" : "Všetky"}
              </button>
            </div>
            {PORTALY.map(p => (
              <Tog key={p.key} on={f.export_portaly[p.key] ?? false} set={v => setEx(p.key, v)} label={p.label} />
            ))}
          </div>

          {/* SEO */}
          <div style={s.card}>
            <div style={s.title}>SEO</div>
            <div style={{ marginBottom: "10px" }}>
              <label style={s.label}>Označenie</label>
              <input style={s.input} placeholder="top" value={f.specialne_oznacenie} onChange={e => set("specialne_oznacenie", e.target.value)} />
            </div>
            <div>
              <label style={s.label}>Keywords <span style={{ color: "#9CA3AF", fontWeight: "400" }}>· AI doplní</span></label>
              <input style={s.input} placeholder="doplní AI automaticky" value={f.seo_keywords} onChange={e => set("seo_keywords", e.target.value)} />
            </div>
          </div>

          {/* Privátne */}
          <div style={{ ...s.card, borderLeft: "3px solid #EF4444" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#EF4444", marginBottom: "12px" }}>Privátne</div>
            <label style={s.label}>Provízia</label>
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
              {["EUR", "%"].map(t => (
                <button key={t} onClick={() => set("provizia_typ", t)} style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: f.provizia_typ === t ? "1.5px solid #111" : "1.5px solid #E5E7EB", background: f.provizia_typ === t ? "#374151" : "#fff", color: f.provizia_typ === t ? "#fff" : "#6B7280" }}>{t}</button>
              ))}
            </div>
            <input style={{ ...s.input, marginBottom: "10px" }} type="number" value={f.provizia_hodnota} onChange={e => set("provizia_hodnota", e.target.value)} />
            <label style={s.label}>Poznámka</label>
            <textarea style={{ ...s.input, resize: "none", height: "60px", fontSize: "12px" }} value={f.poznamka_interna} onChange={e => set("poznamka_interna", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Notifications — fixed toast v rohu aby bol vždy vidieť */}
      {error && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          maxWidth: "420px", padding: "14px 18px", background: "#FEF2F2",
          border: "1px solid #FCA5A5", borderRadius: "12px", fontSize: "13px",
          color: "#B91C1C", display: "flex", alignItems: "flex-start", gap: "10px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>⚠️ {error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontWeight: "600", fontSize: "16px", padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}
      {saved && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          padding: "14px 18px", background: "#F0FDF4",
          border: "1px solid #86EFAC", borderRadius: "12px", fontSize: "13px",
          color: "#166534", boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}>
          ✓ Uložené
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--bg-surface)", borderTop: "1px solid var(--border)", padding: "14px 0", marginTop: "20px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button onClick={() => {
          if (draftKey && typeof window !== "undefined") {
            try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
          }
          setF(defaultForm);
          onCancel?.();
        }} style={{ padding: "9px 18px", background: "var(--bg-surface)", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}>Zahodiť</button>
        <button onClick={() => handleSave(false)} disabled={saving} style={{ padding: "9px 22px", background: "var(--bg-surface)", border: "1.5px solid var(--border)", borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", cursor: "pointer" }}>{editId ? "Uložiť zmeny" : "Uložiť koncept"}</button>
        <button onClick={() => handleSave(true)} disabled={saving} style={{ padding: "9px 24px", background: "#374151", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: saving ? "wait" : "pointer" }}>{saving ? "..." : "Pridať do portfólia"}</button>
      </div>
    </div>
  );
}
