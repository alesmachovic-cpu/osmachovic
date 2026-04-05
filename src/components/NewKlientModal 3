"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface DuplicateHit {
  id: string;
  meno: string;
  telefon?: string;
  email?: string;
  status?: string;
  typ?: string;
  lokalita?: string;
  poznamka?: string;
  created_at: string;
}

interface Props {
  open?: boolean;
  onClose: () => void;
  onCreated?: () => void;
  onSaved?: () => void;
  initialPhone?: string;
  showTypKlienta?: boolean; // len z dashboardu overenia
  defaultTyp?: "kupujuci" | "predavajuci" | "oboje";
  editKlient?: {
    id: string;
    meno: string;
    telefon: string | null;
    email: string | null;
    status: string;
    typ: string;
    lokalita: string | null;
    poznamka: string | null;
  } | null;
}

// TODO: Po spustení SQL migrácie (002_update_klienti_constraints.sql) odkomentuj všetky statusy
const STATUS_OPTIONS = [
  { value: "aktivny", label: "Aktívny" },
  { value: "novy_kontakt", label: "Nový kontakt" },
  { value: "dohodnuty_naber", label: "Dohodnutý náber" },
  { value: "nabrany", label: "Nabraný" },
  { value: "volat_neskor", label: "Volať neskôr" },
  { value: "nedovolal", label: "Nedovolal" },
  { value: "nechce_rk", label: "Nechce RK" },
  { value: "uz_predal", label: "Už predal" },
  { value: "realitna_kancelaria", label: "Realitná kancelária" },
];

/* ── Typ nehnuteľnosti — zladené s InzeratForm ── */
const TYP_GROUPS = [
  { label: "Byty", options: [
    { value: "garsonka", label: "Garsónka" },
    { value: "1-izbovy-byt", label: "1-izbový byt" },
    { value: "2-izbovy-byt", label: "2-izbový byt" },
    { value: "3-izbovy-byt", label: "3-izbový byt" },
    { value: "4-izbovy-byt", label: "4-izbový byt" },
    { value: "5-izbovy-byt", label: "5 a viac izbový byt" },
    { value: "mezonet", label: "Mezonet" },
    { value: "apartman", label: "Apartmán" },
  ]},
  { label: "Domy", options: [
    { value: "rodinny-dom", label: "Rodinný dom" },
    { value: "chata", label: "Chata" },
    { value: "vidiecky-dom", label: "Vidiecky dom" },
    { value: "zrub", label: "Zrub" },
  ]},
  { label: "Pozemky", options: [
    { value: "stavebny-pozemok", label: "Stavebný pozemok" },
    { value: "pozemok-rd", label: "Pre rodinné domy" },
    { value: "zahrada", label: "Záhrada" },
    { value: "polnohospodarska-poda", label: "Poľnohospodárska pôda" },
    { value: "komercna-zona", label: "Komerčná zóna" },
  ]},
  { label: "Komerčné", options: [
    { value: "komercny-objekt", label: "Komerčný objekt" },
    { value: "kancelarie", label: "Kancelárie" },
    { value: "sklad", label: "Sklad" },
    { value: "restauracia", label: "Reštaurácia" },
    { value: "hotel-penzion", label: "Hotel / Penzión" },
  ]},
  { label: "Iné", options: [
    { value: "garaz", label: "Garáž" },
    { value: "ine", label: "Iné" },
  ]},
];

/* ── Smart lokalita — mestské časti, mestá, okresy + ulice ── */
interface LokalitaEntry {
  display: string;     // čo sa zobrazí v dropdown
  lokalita: string;    // uloží sa do DB
  ulica?: string;      // ak je to ulica, auto-fill do ulice
}

const LOKALITY_DB: LokalitaEntry[] = [
  // Bratislava - mestské časti
  { display: "Bratislava - Staré Mesto", lokalita: "Bratislava I" },
  { display: "Bratislava - Ružinov", lokalita: "Bratislava II" },
  { display: "Bratislava - Nové Mesto", lokalita: "Bratislava III" },
  { display: "Bratislava - Karlova Ves", lokalita: "Bratislava IV" },
  { display: "Bratislava - Petržalka", lokalita: "Bratislava V" },
  { display: "Bratislava - Dúbravka", lokalita: "Bratislava IV" },
  { display: "Bratislava - Rača", lokalita: "Bratislava III" },
  { display: "Bratislava - Vrakuňa", lokalita: "Bratislava II" },
  { display: "Bratislava - Podunajské Biskupice", lokalita: "Bratislava II" },
  { display: "Bratislava - Devín", lokalita: "Bratislava IV" },
  { display: "Bratislava - Devínska Nová Ves", lokalita: "Bratislava IV" },
  { display: "Bratislava - Záhorská Bystrica", lokalita: "Bratislava IV" },
  { display: "Bratislava - Lamač", lokalita: "Bratislava IV" },
  { display: "Bratislava - Čunovo", lokalita: "Bratislava V" },
  { display: "Bratislava - Jarovce", lokalita: "Bratislava V" },
  { display: "Bratislava - Rusovce", lokalita: "Bratislava V" },
  { display: "Bratislava - Vajnory", lokalita: "Bratislava III" },
  // Košice - mestské časti
  { display: "Košice - Staré Mesto", lokalita: "Košice I" },
  { display: "Košice - Juh", lokalita: "Košice II" },
  { display: "Košice - Dargovských hrdinov", lokalita: "Košice III" },
  { display: "Košice - Západ", lokalita: "Košice IV" },
  { display: "Košice - Sever", lokalita: "Košice I" },
  { display: "Košice - KVP", lokalita: "Košice IV" },
  { display: "Košice - Šaca", lokalita: "Košice IV" },
  // Krajské mestá a väčšie mestá
  { display: "Trnava", lokalita: "Trnava" },
  { display: "Nitra", lokalita: "Nitra" },
  { display: "Trenčín", lokalita: "Trenčín" },
  { display: "Žilina", lokalita: "Žilina" },
  { display: "Banská Bystrica", lokalita: "Banská Bystrica" },
  { display: "Prešov", lokalita: "Prešov" },
  { display: "Martin", lokalita: "Martin" },
  { display: "Poprad", lokalita: "Poprad" },
  { display: "Piešťany", lokalita: "Piešťany" },
  { display: "Zvolen", lokalita: "Zvolen" },
  { display: "Prievidza", lokalita: "Prievidza" },
  { display: "Považská Bystrica", lokalita: "Považská Bystrica" },
  { display: "Michalovce", lokalita: "Michalovce" },
  { display: "Spišská Nová Ves", lokalita: "Spišská Nová Ves" },
  { display: "Komárno", lokalita: "Komárno" },
  { display: "Levice", lokalita: "Levice" },
  { display: "Humenné", lokalita: "Humenné" },
  { display: "Bardejov", lokalita: "Bardejov" },
  { display: "Liptovský Mikuláš", lokalita: "Liptovský Mikuláš" },
  { display: "Ružomberok", lokalita: "Ružomberok" },
  { display: "Dunajská Streda", lokalita: "Dunajská Streda" },
  { display: "Nové Zámky", lokalita: "Nové Zámky" },
  { display: "Galanta", lokalita: "Galanta" },
  { display: "Senec", lokalita: "Senec" },
  { display: "Pezinok", lokalita: "Pezinok" },
  { display: "Malacky", lokalita: "Malacky" },
  { display: "Stupava", lokalita: "Stupava" },
  { display: "Šamorín", lokalita: "Dunajská Streda" },
  { display: "Modra", lokalita: "Pezinok" },
  { display: "Svätý Jur", lokalita: "Pezinok" },
  { display: "Bernolákovo", lokalita: "Senec" },
  { display: "Ivanka pri Dunaji", lokalita: "Senec" },
  { display: "Skalica", lokalita: "Skalica" },
  { display: "Senica", lokalita: "Senica" },
  // Okresy
  { display: "Okres Bratislava I", lokalita: "Bratislava I" },
  { display: "Okres Bratislava II", lokalita: "Bratislava II" },
  { display: "Okres Bratislava III", lokalita: "Bratislava III" },
  { display: "Okres Bratislava IV", lokalita: "Bratislava IV" },
  { display: "Okres Bratislava V", lokalita: "Bratislava V" },
  { display: "Okres Malacky", lokalita: "Malacky" },
  { display: "Okres Pezinok", lokalita: "Pezinok" },
  { display: "Okres Senec", lokalita: "Senec" },
  { display: "Okres Trnava", lokalita: "Trnava" },
  { display: "Okres Dunajská Streda", lokalita: "Dunajská Streda" },
  { display: "Okres Galanta", lokalita: "Galanta" },
  { display: "Okres Piešťany", lokalita: "Piešťany" },
  { display: "Okres Nitra", lokalita: "Nitra" },
  { display: "Okres Nové Zámky", lokalita: "Nové Zámky" },
  { display: "Okres Komárno", lokalita: "Komárno" },
  { display: "Okres Levice", lokalita: "Levice" },
  { display: "Okres Trenčín", lokalita: "Trenčín" },
  { display: "Okres Žilina", lokalita: "Žilina" },
  { display: "Okres Martin", lokalita: "Martin" },
  { display: "Okres Banská Bystrica", lokalita: "Banská Bystrica" },
  { display: "Okres Zvolen", lokalita: "Zvolen" },
  { display: "Okres Prešov", lokalita: "Prešov" },
  { display: "Okres Poprad", lokalita: "Poprad" },
  { display: "Okres Košice I", lokalita: "Košice I" },
  { display: "Okres Košice II", lokalita: "Košice II" },
  { display: "Okres Košice III", lokalita: "Košice III" },
  { display: "Okres Košice IV", lokalita: "Košice IV" },
  { display: "Okres Košice-okolie", lokalita: "Košice-okolie" },
  { display: "Okres Michalovce", lokalita: "Michalovce" },
  // Známe ulice Bratislava — Petržalka
  { display: "Nám. hraničiarov → Petržalka", lokalita: "Bratislava V", ulica: "Nám. hraničiarov" },
  { display: "Rusovská cesta → Petržalka", lokalita: "Bratislava V", ulica: "Rusovská cesta" },
  { display: "Kutlíkova → Petržalka", lokalita: "Bratislava V", ulica: "Kutlíkova" },
  { display: "Budatínska → Petržalka", lokalita: "Bratislava V", ulica: "Budatínska" },
  { display: "Hálovej → Petržalka", lokalita: "Bratislava V", ulica: "Hálovej" },
  { display: "Lachova → Petržalka", lokalita: "Bratislava V", ulica: "Lachova" },
  { display: "Romanova → Petržalka", lokalita: "Bratislava V", ulica: "Romanova" },
  { display: "Jungmannova → Petržalka", lokalita: "Bratislava V", ulica: "Jungmannova" },
  { display: "Ovsištské nám. → Petržalka", lokalita: "Bratislava V", ulica: "Ovsištské nám." },
  { display: "Mamateyova → Petržalka", lokalita: "Bratislava V", ulica: "Mamateyova" },
  { display: "Fedinova → Petržalka", lokalita: "Bratislava V", ulica: "Fedinova" },
  { display: "Černyševského → Petržalka", lokalita: "Bratislava V", ulica: "Černyševského" },
  // Bratislava — Ružinov
  { display: "Bajkalská → Ružinov", lokalita: "Bratislava II", ulica: "Bajkalská" },
  { display: "Drieňová → Ružinov", lokalita: "Bratislava II", ulica: "Drieňová" },
  { display: "Ružová dolina → Ružinov", lokalita: "Bratislava II", ulica: "Ružová dolina" },
  { display: "Prievozská → Ružinov", lokalita: "Bratislava II", ulica: "Prievozská" },
  { display: "Tomášikova → Ružinov", lokalita: "Bratislava II", ulica: "Tomášikova" },
  { display: "Miletičova → Ružinov", lokalita: "Bratislava II", ulica: "Miletičova" },
  { display: "Ružinovská → Ružinov", lokalita: "Bratislava II", ulica: "Ružinovská" },
  { display: "Záhradnícka → Ružinov", lokalita: "Bratislava II", ulica: "Záhradnícka" },
  // Bratislava — Staré Mesto
  { display: "Obchodná → Staré Mesto", lokalita: "Bratislava I", ulica: "Obchodná" },
  { display: "Laurinská → Staré Mesto", lokalita: "Bratislava I", ulica: "Laurinská" },
  { display: "Ventúrska → Staré Mesto", lokalita: "Bratislava I", ulica: "Ventúrska" },
  { display: "Michalská → Staré Mesto", lokalita: "Bratislava I", ulica: "Michalská" },
  { display: "Palisády → Staré Mesto", lokalita: "Bratislava I", ulica: "Palisády" },
  { display: "Štefánikova → Staré Mesto", lokalita: "Bratislava I", ulica: "Štefánikova" },
  { display: "Grösslingová → Staré Mesto", lokalita: "Bratislava I", ulica: "Grösslingová" },
  // Bratislava — Nové Mesto
  { display: "Vajnorská → Nové Mesto", lokalita: "Bratislava III", ulica: "Vajnorská" },
  { display: "Račianska → Nové Mesto", lokalita: "Bratislava III", ulica: "Račianska" },
  { display: "Trnavská cesta → Nové Mesto", lokalita: "Bratislava III", ulica: "Trnavská cesta" },
  { display: "Hálkova → Nové Mesto", lokalita: "Bratislava III", ulica: "Hálkova" },
  // Bratislava — Karlova Ves / Dúbravka
  { display: "Karloveská → Karlova Ves", lokalita: "Bratislava IV", ulica: "Karloveská" },
  { display: "Saratovská → Dúbravka", lokalita: "Bratislava IV", ulica: "Saratovská" },
  { display: "Pri kríži → Dúbravka", lokalita: "Bratislava IV", ulica: "Pri kríži" },
];

function normalizeSearch(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s]/g, "");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-\(\)]/g, "").replace(/^00/, "+");
}

function getLastDigits(phone: string, count: number): string {
  return phone.replace(/\D/g, "").slice(-count);
}

export default function NewKlientModal({ open, onClose, onCreated, onSaved, initialPhone, showTypKlienta = false, defaultTyp = "predavajuci", editKlient }: Props) {
  const isEdit = !!editKlient;
  const [telefon, setTelefon] = useState(editKlient?.telefon || initialPhone || "");
  const [meno, setMeno] = useState(editKlient?.meno || "");
  const [email, setEmail] = useState(editKlient?.email || "");
  const [status, setStatus] = useState(editKlient?.status || "aktivny");
  const [typKlienta, setTypKlienta] = useState<string>(editKlient?.typ || defaultTyp);
  const [typNehnutelnosti, setTypNehnutelnosti] = useState("");
  const [lokalitaInput, setLokalitaInput] = useState(editKlient?.lokalita || "");
  const [lokalitaValue, setLokalitaValue] = useState(editKlient?.lokalita || ""); // actual DB value
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ulica, setUlica] = useState("");
  const [datumStretnutia, setDatumStretnutia] = useState("");
  const [odkaz, setOdkaz] = useState("");
  const [poznamka, setPoznamka] = useState(editKlient?.poznamka || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [calendarSynced, setCalendarSynced] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  // Duplicate check
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [dupLevel, setDupLevel] = useState<"none" | "warning" | "critical">("none");
  const [forceCreate, setForceCreate] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCalendar = status === "dohodnuty_naber" || status === "volat_neskor";

  // Auto-check phone (skip in edit mode)
  useEffect(() => {
    if (isEdit) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const norm = normalizePhone(telefon);
    const digits = norm.replace(/\D/g, "");
    if (digits.length < 6) {
      setChecked(false); setDuplicates([]); setDupLevel("none"); setForceCreate(false); setAutoFilled(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      const last9 = getLastDigits(norm, 9);
      const { data } = await supabase
        .from("klienti")
        .select("id, meno, telefon, email, status, typ, lokalita, poznamka, created_at")
        .ilike("telefon", `%${last9}%`);
      const hits = (data as DuplicateHit[] | null) ?? [];
      setDuplicates(hits);
      setChecked(true);
      setChecking(false);
      if (hits.length === 0) {
        setDupLevel("none");
      } else {
        // Auto-fill meno a email z nájdeného klienta
        const match = hits[0];
        if (!autoFilled) {
          if (match.meno && !meno.trim()) setMeno(match.meno);
          if (match.email && !email.trim()) setEmail(match.email);
          setAutoFilled(true);
        }
        // Kritická duplicita = telefón + meno + (email ALEBO lokalita)
        const hasCritical = hits.some(h => {
          const hLast9 = getLastDigits(h.telefon || "", 9);
          if (hLast9 !== last9) return false;
          const sameName = meno.trim() && h.meno?.toLowerCase() === meno.trim().toLowerCase();
          if (!sameName) return false;
          const sameEmail = email.trim() && h.email && h.email.toLowerCase() === email.trim().toLowerCase();
          const sameLokalita = lokalitaValue && h.lokalita && h.lokalita.toLowerCase() === lokalitaValue.toLowerCase();
          return sameEmail || sameLokalita;
        });
        setDupLevel(hasCritical ? "critical" : "warning");
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [telefon, meno, email, lokalitaValue]);

  useEffect(() => {
    if (!showCalendar) { setDatumStretnutia(""); setCalendarSynced(false); }
  }, [showCalendar]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!open) return null;

  // Smart locality search
  const normalizedInput = normalizeSearch(lokalitaInput);
  const suggestions = normalizedInput.length >= 2
    ? LOKALITY_DB.filter(l => normalizeSearch(l.display).includes(normalizedInput)).slice(0, 8)
    : [];

  function selectLokalita(entry: LokalitaEntry) {
    if (entry.ulica) {
      // Ulica match — vyplň lokalitu aj ulicu
      const displayName = LOKALITY_DB.find(l => l.lokalita === entry.lokalita && !l.ulica)?.display || entry.lokalita;
      setLokalitaInput(displayName);
      setLokalitaValue(entry.lokalita);
      setUlica(entry.ulica);
    } else {
      setLokalitaInput(entry.display);
      setLokalitaValue(entry.lokalita);
    }
    setShowSuggestions(false);
  }

  async function handleSave() {
    if (!telefon.trim() || !meno.trim()) return;
    if (!isEdit && dupLevel === "critical" && !forceCreate) return;
    setSaving(true);
    setSaveError("");

    // TODO: Po SQL migrácii zmeniť na: dupLevel === "critical" ? "caka_na_schvalenie" : status
    const finalStatus = "aktivny"; // Dočasne — DB constraint povoľuje len "aktivny"

    const payload = {
      meno: meno.trim(),
      telefon: normalizePhone(telefon),
      email: email.trim() || null,
      status: isEdit ? status : finalStatus,
      typ: typKlienta,
      lokalita: lokalitaValue || lokalitaInput.trim() || null,
      odkaz: odkaz.trim() || null,
      poznamka: isEdit ? (poznamka.trim() || null) : ([
        ulica ? `Ulica: ${ulica}` : "",
        typNehnutelnosti ? `Typ nehnuteľnosti: ${typNehnutelnosti}` : "",
        datumStretnutia ? `Stretnutie: ${datumStretnutia}` : "",
        dupLevel === "critical" ? `⚠️ DUPLICITA — čaká na schválenie manažérom` : "",
        poznamka,
      ].filter(Boolean).join("\n") || null),
    };

    const { error } = isEdit
      ? await supabase.from("klienti").update(payload).eq("id", editKlient!.id)
      : await supabase.from("klienti").insert(payload);

    if (!error && !isEdit && dupLevel !== "none") {
      await supabase.from("logy").insert({
        typ: dupLevel === "critical" ? "duplicita_kriticka" : "duplicita_upozornenie",
        popis: `Duplicitný klient: ${meno.trim()} (${normalizePhone(telefon)}). Zhoduje sa s: ${duplicates.map(d => `${d.meno} (${d.telefon})`).join(", ")}`,
        metadata: {
          novy_telefon: normalizePhone(telefon),
          existujuce: duplicates.map(d => ({ id: d.id, meno: d.meno, telefon: d.telefon, status: d.status })),
        },
      });

      // Návrh na doplnenie údajov pôvodnému maklérovi
      for (const dup of duplicates) {
        const newData: Record<string, string> = {};
        if (email.trim() && !dup.email) newData.email = email.trim();
        if (meno.trim() && !dup.meno) newData.meno = meno.trim();
        if (Object.keys(newData).length > 0) {
          await supabase.from("logy").insert({
            typ: "navrh_doplnenia",
            popis: `💡 Nový makler pridal klienta ${meno.trim()} (${normalizePhone(telefon)}) — navrhuje doplniť: ${Object.entries(newData).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
            metadata: {
              klient_id: dup.id,
              navrhovane_udaje: newData,
              stav: "caka_na_schvalenie",
            },
          });
        }
      }
    }

    // Calendar sync (only for new clients)
    if (!error && !isEdit && showCalendar && datumStretnutia) {
      try {
        await fetch("/api/calendar-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: status === "dohodnuty_naber" ? `Náber: ${meno.trim()}` : `Zavolať: ${meno.trim()}`,
            datetime: datumStretnutia,
            description: `Klient: ${meno.trim()}\nTel: ${normalizePhone(telefon)}\nLokalita: ${lokalitaValue || lokalitaInput}\nTyp: ${typNehnutelnosti}`,
            telefon: normalizePhone(telefon),
          }),
        });
      } catch { /* silent */ }
    }

    setSaving(false);
    if (error) {
      console.error("[NewKlientModal] Chyba pri ukladaní:", error);
      setSaveError(error.message || "Nepodarilo sa uložiť klienta");
      return;
    }
    setTelefon(""); setMeno(""); setEmail(""); setStatus("aktivny");
    setTypKlienta("kupujuci"); setTypNehnutelnosti("");
    setLokalitaInput(""); setLokalitaValue("");
    setUlica(""); setDatumStretnutia(""); setOdkaz(""); setPoznamka("");
    setChecked(false); setDuplicates([]); setDupLevel("none");
    setCalendarSynced(false); setSaveError("");
    onCreated?.();
    onSaved?.();
    onClose();
  }

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
    color: "var(--text-primary)", outline: "none",
  };
  const labelSt: React.CSSProperties = {
    fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px",
  };
  const selectSt: React.CSSProperties = {
    ...inputSt, cursor: "pointer", appearance: "none" as const,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "20px", padding: "28px",
        width: "520px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: 0, color: "var(--text-primary)" }}>{isEdit ? "Upraviť klienta" : "+ Nový klient"}</h2>
          <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "none", background: "var(--bg-elevated)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)" }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Telefón */}
          <div>
            <div style={labelSt}>Telefón *</div>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inputSt, border: checked ? (dupLevel === "none" ? "2px solid #10B981" : dupLevel === "warning" ? "2px solid #F59E0B" : "2px solid #EF4444") : "1px solid var(--border)", paddingRight: "40px" }}
                placeholder="+421 900 000 000"
                value={telefon}
                onChange={e => setTelefon(e.target.value)}
                autoFocus
              />
              {checking && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px" }}>⏳</span>}
              {checked && !checking && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px" }}>{dupLevel === "none" ? "✅" : dupLevel === "warning" ? "⚠️" : "🚨"}</span>}
            </div>

            {checked && dupLevel === "none" && (
              <div style={{ marginTop: "8px", padding: "8px 12px", background: "#D1FAE5", borderRadius: "8px", fontSize: "12px", color: "#065F46", fontWeight: "500" }}>
                ✅ Číslo nie je v databáze
              </div>
            )}
            {checked && dupLevel === "warning" && (
              <div style={{ marginTop: "8px", padding: "10px 12px", background: "#FEF3C7", borderRadius: "8px", border: "1px solid #F59E0B" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#92400E", marginBottom: "6px" }}>⚠️ Rovnaké číslo, iné údaje</div>
                {duplicates.map(d => (
                  <div key={d.id} style={{ fontSize: "12px", color: "#92400E", padding: "4px 8px", background: "rgba(245,158,11,0.08)", borderRadius: "6px", marginBottom: "3px" }}>
                    <strong>{d.meno}</strong> · {d.typ || "—"} · {d.lokalita || "—"} · {d.status || "—"}
                  </div>
                ))}
              </div>
            )}
            {checked && dupLevel === "critical" && (
              <div style={{ marginTop: "8px", padding: "10px 12px", background: "#FEE2E2", borderRadius: "8px", border: "1px solid #EF4444" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#991B1B", marginBottom: "4px" }}>🚨 ÚPLNÁ DUPLICITA</div>
                <div style={{ fontSize: "11px", color: "#991B1B", marginBottom: "6px" }}>Klient bude <strong>neaktívny</strong> kým ho manažér neschváli.</div>
                {duplicates.map(d => (
                  <div key={d.id} style={{ fontSize: "12px", color: "#991B1B", padding: "4px 8px", background: "rgba(239,68,68,0.08)", borderRadius: "6px", marginBottom: "3px" }}>
                    <strong>{d.meno}</strong> · {d.telefon} · {d.status || "—"} · {d.status || "—"}
                  </div>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "12px", color: "#991B1B", cursor: "pointer" }}>
                  <input type="checkbox" checked={forceCreate} onChange={e => setForceCreate(e.target.checked)} />
                  Vytvoriť napriek duplicite (bude neaktívny)
                </label>
              </div>
            )}
          </div>

          {/* Meno */}
          <div>
            <div style={labelSt}>Meno a priezvisko *</div>
            <input style={inputSt} placeholder="Meno a priezvisko" value={meno} onChange={e => setMeno(e.target.value)} />
          </div>

          {/* Email */}
          <div>
            <div style={labelSt}>Email</div>
            <input style={inputSt} placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          {/* Status + Typ klienta */}
          <div style={{ display: "grid", gridTemplateColumns: showTypKlienta ? "1fr 1fr" : "1fr", gap: "12px" }}>
            <div>
              <div style={labelSt}>Status *</div>
              <select value={status} onChange={e => setStatus(e.target.value)} style={selectSt}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {showTypKlienta && (
              <div>
                <div style={labelSt}>Typ klienta *</div>
                <select value={typKlienta} onChange={e => setTypKlienta(e.target.value)} style={selectSt}>
                  <option value="kupujuci">Kupujúci</option>
                  <option value="predavajuci">Predávajúci</option>
                  <option value="oboje">Kupujúci + Predávajúci</option>
                </select>
              </div>
            )}
          </div>

          {/* Typ nehnuteľnosti */}
          <div>
            <div style={labelSt}>Typ nehnuteľnosti</div>
            <select value={typNehnutelnosti} onChange={e => setTypNehnutelnosti(e.target.value)} style={selectSt}>
              <option value="">— vyberte —</option>
              {TYP_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Lokalita — smart autocomplete */}
          <div ref={suggestRef} style={{ position: "relative" }}>
            <div style={labelSt}>Lokalita *</div>
            <input
              style={{ ...inputSt, border: lokalitaValue ? "2px solid #10B981" : "1px solid var(--border)" }}
              placeholder="Začni písať mesto, časť alebo okres..."
              value={lokalitaInput}
              onChange={e => { setLokalitaInput(e.target.value); setLokalitaValue(""); setShowSuggestions(true); }}
              onFocus={() => { if (normalizeSearch(lokalitaInput).length >= 2) setShowSuggestions(true); }}
            />
            {lokalitaValue && <div style={{ fontSize: "11px", color: "#065F46", marginTop: "4px" }}>→ {lokalitaValue}</div>}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", marginTop: "4px", overflow: "hidden",
              }}>
                {suggestions.map((s, i) => (
                  <div key={i} onClick={() => selectLokalita(s)} style={{
                    padding: "10px 14px", fontSize: "13px", cursor: "pointer",
                    borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>{s.display}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{s.lokalita}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ulica */}
          <div>
            <div style={labelSt}>Ulica</div>
            <input style={inputSt} placeholder="Ulica a číslo" value={ulica} onChange={e => setUlica(e.target.value)} />
          </div>

          {/* Kalendár — len pre dohodnutý náber / volať neskôr */}
          {showCalendar && (
            <div>
              <div style={labelSt}>
                {status === "dohodnuty_naber" ? "Dátum stretnutia *" : "Zavolať dňa *"}
                <span style={{ textTransform: "none", fontWeight: "400", marginLeft: "6px" }}>— sync s Google Kalendárom</span>
              </div>
              <input type="datetime-local" style={inputSt} value={datumStretnutia} onChange={e => { setDatumStretnutia(e.target.value); setCalendarSynced(false); }} />
            </div>
          )}

          {/* Odkaz na nehnuteľnosť */}
          <div>
            <div style={labelSt}>Odkaz na nehnuteľnosť</div>
            <input style={inputSt} placeholder="https://nehnutelnosti.sk/... alebo realit.sk/..." value={odkaz} onChange={e => setOdkaz(e.target.value)} />
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>Link na inzerát — studený náber, Google Maps pin</div>
          </div>

          {/* Poznámka */}
          <div>
            <div style={labelSt}>Poznámka</div>
            <textarea style={{ ...inputSt, minHeight: "70px", resize: "vertical", fontFamily: "inherit" }}
              placeholder="Interná poznámka..."
              value={poznamka} onChange={e => setPoznamka(e.target.value)} />
          </div>
        </div>

        {/* Error */}
        {saveError && (
          <div style={{ marginTop: "16px", padding: "10px 14px", background: "#FEE2E2", borderRadius: "8px", fontSize: "13px", color: "#991B1B", fontWeight: "500" }}>
            ❌ {saveError}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px", cursor: "pointer", color: "var(--text-secondary)" }}>Zrušiť</button>
          <button onClick={handleSave}
            disabled={saving || !telefon.trim() || !meno.trim() || (!isEdit && dupLevel === "critical" && !forceCreate)}
            style={{
              padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              opacity: saving || !telefon.trim() || !meno.trim() || (!isEdit && dupLevel === "critical" && !forceCreate) ? 0.4 : 1,
            }}>
            {saving ? "Ukladám..." : isEdit ? "Uložiť zmeny" : "Vytvoriť klienta"}
          </button>
        </div>
      </div>
    </div>
  );
}
