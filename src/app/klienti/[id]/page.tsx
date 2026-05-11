"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { STATUS_LABELS } from "@/lib/database.types";
import type { Klient, KlientStatus } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";
import SlaTimer from "@/components/SlaTimer";
import KlientHistoryTab from "@/components/KlientHistoryTab";
import { useAuth } from "@/components/AuthProvider";
import { getMaklerUuid } from "@/lib/maklerMap";
import { listKlientDokumenty, deleteKlientDokument, saveKlientDokument, type KlientDokument } from "@/lib/klientDokumenty";
import { createCalendarEvent, notifyCalendarFail } from "@/lib/calendar";
import { klientUpdate } from "@/lib/klientApi";
import SmsSignButton from "@/components/SmsSignButton";
import { NajlepsieZhodyPanel } from "@/components/matching/NajlepsieZhodyPanel";
import { HypotekaMiniCalc } from "@/components/calc/HypotekaMiniCalc";
import { ProviziaMiniCalc } from "@/components/calc/ProviziaMiniCalc";
import { ClientInsightPanel } from "@/components/client-insight/ClientInsightPanel";

// ── LV sekcia s uploadom a parsovaním ──
function LVSection({ klientId, lvData, onParsed, canEdit = true, klientMeno = "", klientLokalita = "", onFixName, onFixLocation, userId }: {
  klientId: string;
  lvData: Record<string, unknown> | null | undefined;
  onParsed: (data: Record<string, unknown>) => void;
  canEdit?: boolean;
  klientMeno?: string;
  klientLokalita?: string;
  onFixName?: (newName: string) => Promise<void>;
  onFixLocation?: (newLokalita: string) => Promise<void>;
  userId: string;
}) {
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState("");
  // Modal už nie je v LVSection — spravuje ho rodič cez onParsed callback

  async function handleLVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setParsing(true);
    setErr("");
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/parse-lv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_base64: base64, filename: file.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const parsed = await res.json();

      // Ulož do klienta cez API endpoint (ownership check)
      await klientUpdate(userId, klientId, { lv_data: parsed });
      console.log("[LVSection] LV uložené do DB, volám onParsed...");
      onParsed(parsed);
      console.log("[LVSection] onParsed hotové, rodičovský modal by mal byť otvorený");
    } catch (e) {
      setErr("Chyba pri analýze LV: " + (e as Error).message.slice(0, 120));
    } finally {
      setParsing(false);
    }
  }

  const lv = lvData as Record<string, unknown> | null | undefined;
  const majitelia = (lv?.majitelia as Array<Record<string, string>> | undefined) ?? [];
  const pozemky = (lv?.pozemky as Array<Record<string, unknown>> | undefined) ?? [];
  const lvObec = lv?.obec ? String(lv.obec) : "";
  const lvUlica = lv?.ulica ? String(lv.ulica) : "";
  const lvOkres = lv?.okres ? String(lv.okres) : "";
  const lvPlocha = lv?.plocha ? String(lv.plocha) : "";
  const lvIzby = lv?.izby ? String(lv.izby) : "";
  const lvPravneVady = lv?.pravne_vady ? String(lv.pravne_vady) : "";

  // Mismatch detekcia — zobrazí warning banner s tlačidlom na opravu
  const ownerNames: string[] = (() => {
    const names: string[] = [];
    for (const m of majitelia.filter(m => m.meno)) {
      const parts = m.meno!.split(/\s+a\s+/i).map(n => n.trim()).filter(n => n.length > 2);
      names.push(...(parts.length > 1 ? parts : [m.meno!]));
    }
    return names;
  })();
  const nameCurrent = klientMeno.trim().toLowerCase();
  const nameMatches = !nameCurrent || ownerNames.length === 0 ||
    ownerNames.some(n => n.toLowerCase() === nameCurrent ||
                         nameCurrent.includes(n.toLowerCase()) ||
                         n.toLowerCase().includes(nameCurrent));
  const locCurrent = klientLokalita.trim().toLowerCase();
  const locLv = lvObec.trim().toLowerCase();
  const locMatches = !locCurrent || !locLv || locCurrent === locLv ||
    locCurrent.includes(locLv) || locLv.includes(locCurrent);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [fixingName, setFixingName] = useState(false);
  const [fixingLoc, setFixingLoc] = useState(false);
  useEffect(() => { if (ownerNames.length > 0 && !selectedOwner) setSelectedOwner(ownerNames[0]); }, [ownerNames, selectedOwner]);

  return (
    <div style={{
      background: "var(--bg-surface)", border: lv ? "1px solid #BBF7D0" : "1px solid var(--border)",
      borderRadius: "14px", padding: "20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: lv ? "16px" : "0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>📋</span>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>
              List vlastníctva (LV)
            </div>
            {lv && (
              <div style={{ fontSize: "11px", color: "#059669", fontWeight: "600" }}>
                Analyzovaný · auto-vyplní náberový list
              </div>
            )}
          </div>
        </div>
        {canEdit && (
          <label style={{
            padding: "7px 14px", background: parsing ? "var(--bg-elevated)" : "#374151",
            color: parsing ? "var(--text-muted)" : "#fff", borderRadius: "9px",
            fontSize: "12px", fontWeight: "600", cursor: parsing ? "default" : "pointer",
            border: "none", display: "inline-block",
          }}>
            {parsing ? "Analyzujem..." : lv ? "Nahrať znova" : "Nahrať LV"}
            <input type="file" accept=".pdf,image/*" onChange={handleLVUpload} style={{ display: "none" }} disabled={parsing} />
          </label>
        )}
      </div>
      {err && <div style={{ fontSize: "12px", color: "#EF4444", marginTop: "8px" }}>{err}</div>}


      {lv && canEdit && (!nameMatches || !locMatches) && (
        <div style={{ marginTop: "12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "14px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#92400E", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            ⚠️ Údaje klienta sa nezhodujú s LV
          </div>
          {!nameMatches && ownerNames.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "#92400E" }}>
                Meno: <strong>{klientMeno}</strong> → vlastník z LV:
              </span>
              <select value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)}
                style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid #FDE68A", background: "#fff", color: "#92400E" }}>
                {ownerNames.map((n, i) => <option key={i} value={n}>{n}</option>)}
              </select>
              <button
                disabled={fixingName || !selectedOwner}
                onClick={async () => {
                  if (!onFixName || !selectedOwner) return;
                  setFixingName(true);
                  try { await onFixName(selectedOwner); } finally { setFixingName(false); }
                }}
                style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 600, background: "#D97706", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                {fixingName ? "Ukladám..." : "Premenovať klienta"}
              </button>
            </div>
          )}
          {!locMatches && lvObec && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "#92400E" }}>
                Lokalita: <strong>{klientLokalita}</strong> → z LV: <strong>{lvObec}</strong>
              </span>
              <button
                disabled={fixingLoc}
                onClick={async () => {
                  if (!onFixLocation) return;
                  setFixingLoc(true);
                  try { await onFixLocation(lvObec); } finally { setFixingLoc(false); }
                }}
                style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 600, background: "#D97706", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                {fixingLoc ? "Ukladám..." : "Prepísať lokalitu"}
              </button>
            </div>
          )}
        </div>
      )}
      {lv && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          {/* Adresa */}
          {(lvObec || lvUlica) && (
            <div style={{ fontSize: "13px", color: "var(--text-primary)", display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--text-muted)", minWidth: "80px", fontSize: "11px", fontWeight: "600", paddingTop: "2px" }}>ADRESA</span>
              <span>{[lvUlica, lvObec, lvOkres].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {majitelia.length > 0 && (
            <div style={{ fontSize: "13px", color: "var(--text-primary)", display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--text-muted)", minWidth: "80px", fontSize: "11px", fontWeight: "600", paddingTop: "2px" }}>
                {majitelia.length > 1 ? "VLASTNÍCI" : "VLASTNÍK"}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {majitelia.map((m, i) => (
                  <span key={i}>{m.meno}{m.podiel && m.podiel !== "1/1" ? <span style={{ color: "var(--text-muted)" }}> ({m.podiel})</span> : ""}</span>
                ))}
              </div>
            </div>
          )}
          {(lvPlocha || lvIzby) && (
            <div style={{ fontSize: "13px", color: "var(--text-primary)", display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--text-muted)", minWidth: "80px", fontSize: "11px", fontWeight: "600", paddingTop: "2px" }}>PLOCHA</span>
              <span>{[lvPlocha ? `${lvPlocha} m²` : null, lvIzby ? `${lvIzby}-izb.` : null].filter(Boolean).join(" · ")}</span>
            </div>
          )}
          {pozemky.length > 0 && (
            <div style={{ fontSize: "13px", color: "var(--text-primary)", display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--text-muted)", minWidth: "80px", fontSize: "11px", fontWeight: "600", paddingTop: "2px" }}>POZEMKY</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {pozemky.map((p, i) => (
                  <span key={i}>parc. {String(p.cislo_parcely ?? "")}{p.druh ? ` — ${String(p.druh)}` : ""}{p.vymera ? `, ${String(p.vymera)} m²` : ""}</span>
                ))}
              </div>
            </div>
          )}
          {lvPravneVady && (
            <div style={{ fontSize: "13px", display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--text-muted)", minWidth: "80px", fontSize: "11px", fontWeight: "600", paddingTop: "2px" }}>ŤARCHY</span>
              <span style={{ color: "#D97706" }}>{lvPravneVady}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Typy pre timeline
interface TimelineEvent {
  id: string;
  type: "status_change" | "naber" | "objednavka" | "inzerat" | "poznamka" | "system" | "obhliadka" | "nehnutelnost" | "dokument" | "udalost";
  deletable?: boolean;
  title: string;
  detail?: string;
  date: string;
  icon: string;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  aktivny: "#059669",
  novy_kontakt: "#3B82F6",
  dohodnuty_naber: "#059669",
  nabrany: "#0891B2",
  volat_neskor: "#F59E0B",
  nedovolal: "#EF4444",
  nechce_rk: "#6B7280",
  uz_predal: "#6B7280",
  realitna_kancelaria: "#6B7280",
  uzavrety: "#374151",
  pasivny: "#9CA3AF",
};

const TYP_LABELS: Record<string, string> = {
  predavajuci: "Predávajúci",
  kupujuci: "Kupujúci",
  oboje: "Predávajúci aj kupujúci",
  prenajimatel: "Prenajímateľ",
};

// Workflow kroky
const WORKFLOW_STEPS = [
  { key: "novy_kontakt", label: "Kontakt", icon: "📞", statuses: ["novy", "novy_kontakt", "aktivny"] },
  { key: "dohodnuty_naber", label: "Dohodnutý", icon: "🤝", statuses: ["dohodnuty_naber"] },
  { key: "nabrany", label: "Nabraný", icon: "📝", statuses: ["nabrany"] },
  { key: "inzerovany", label: "Inzerovaný", icon: "📰", statuses: [] },
  { key: "predany", label: "Predaný", icon: "✅", statuses: ["uzavrety"] },
];

const COMBINED_STEPS = [
  { key: "kontakt",    label: "Kontakt" },
  { key: "dohodnuty",  label: "Dohodnutý" },
  { key: "nabrany",    label: "Nabraný" },
  { key: "inzerovany", label: "Inzerovaný" },
  { key: "obhliadky",  label: "Obhliadky" },
  { key: "rezervacia", label: "Rezervácia" },
  { key: "podpis_kz",  label: "Podpis KZ" },
  { key: "vklad",      label: "Vklad" },
  { key: "predany",    label: "Predaný" },
];

export default function KlientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const id = params.id as string;
  // Kam sa vrátiť tlačidlom "späť" — rešpektuje odkial používateľ prišiel
  // (z /kupujuci by sa mal vrátiť do /kupujuci, default je /klienti).
  const fromParam = searchParams.get("from");
  const backHref = fromParam === "kupujuci" ? "/kupujuci" : "/klienti";
  const backLabel = fromParam === "kupujuci" ? "Kupujúci" : "Klienti";

  const [klient, setKlient] = useState<Klient | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<string>("all");
  const [quickAddTyp, setQuickAddTyp] = useState<"hovor" | "poznamka" | "stretnutie" | "email" | null>(null);
  const [quickAddText, setQuickAddText] = useState("");
  const [quickAddDatum, setQuickAddDatum] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [nabery, setNabery] = useState<Record<string, unknown>[]>([]);
  const [objednavky, setObjednavky] = useState<Record<string, unknown>[]>([]);
  const [inzeraty, setInzeraty] = useState<Record<string, unknown>[]>([]);
  const [activeTab, setActiveTab] = useState<"timeline" | "nehnutelnosti" | "objednavky" | "obhliadky" | "dokumenty" | "historia">("timeline");
  const [klientDokumenty, setKlientDokumenty] = useState<KlientDokument[]>([]);
  const [obhliadky, setObhliadky] = useState<Record<string, unknown>[]>([]);
  const [detailObj, setDetailObj] = useState<Record<string, unknown> | null>(null);
  const [showObhliadkaModal, setShowObhliadkaModal] = useState(false);
  const [obhliadkaPrefill, setObhliadkaPrefill] = useState<{ datum: string; miesto: string } | null>(null);
  const [insightKupujuciPrefill, setInsightKupujuciPrefill] = useState<{ klientId: string; meno: string; tel?: string | null } | null>(null);
  // Pamätáme si, či sa Obhliadka modal otvoril z datetime pickeru (tlačidlo "Späť")
  const [obhliadkaCameFromPicker, setObhliadkaCameFromPicker] = useState(false);
  const [wideLayout, setWideLayout] = useState(false);
  useEffect(() => {
    const check = () => setWideLayout(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // Dokumenty UI state — accordion zbaľovanie, filter typu, otvorený "Presunúť" menu
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [docTypeFilter, setDocTypeFilter] = useState<string>("");
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    listKlientDokumenty(id).then(setKlientDokumenty);
    fetch(`/api/obhliadky?klient_id=${id}`).then(r => r.json()).then(d => setObhliadky(d.obhliadky || [])).catch(() => {});
  }, [id, activeTab]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [naberDatum, setNaberDatum] = useState("");
  const [naberMiesto, setNaberMiesto] = useState("");
  const [naberUlica, setNaberUlica] = useState("");
  const [naberCislo, setNaberCislo] = useState("");
  const [naberAddrError, setNaberAddrError] = useState("");
  const [eventType, setEventType] = useState<"volat" | "naber" | "obhliadka" | "podpis" | "fotenie" | "odovzdanie" | "ine">("naber");
  const [eventTitle, setEventTitle] = useState("");
  const [showLVPrompt, setShowLVPrompt] = useState(false);
  const [lvDiff, setLvDiff] = useState<{ field: string; label: string; old: string; new_: string }[]>([]);
  const [showLVDiff, setShowLVDiff] = useState(false);
  const [showLVRename, setShowLVRename] = useState(false);
  const [lvOwnerNames, setLvOwnerNames] = useState<string[]>([]);

  // Unified LV edit modal — VŽDY vyskakuje po LV uploade (nezávisle od mismatch)
  const [showLvEditModal, setShowLvEditModal] = useState(false);
  const [lvEditOwners, setLvEditOwners] = useState<string[]>([]);
  const [lvEditObec, setLvEditObec] = useState("");
  const [lvEditUlica, setLvEditUlica] = useState("");
  const [lvEditOkres, setLvEditOkres] = useState("");
  const [lvEditPickedOwner, setLvEditPickedOwner] = useState("");
  const [lvEditPickedLok, setLvEditPickedLok] = useState("");
  const [lvEditPickedAdresa, setLvEditPickedAdresa] = useState("");
  const [lvEditFixName, setLvEditFixName] = useState(true);
  const [lvEditFixLok, setLvEditFixLok] = useState(true);
  const [lvEditSaving, setLvEditSaving] = useState(false);

  // VŽDY otvorí modal po úspešnom LV uploade — nech si makler potvrdí alebo zmení údaje
  function openLvEditModalAlways(parsed: Record<string, unknown>) {
    const majiteliaNew = (parsed.majitelia as Array<{ meno?: string }> | undefined) ?? [];
    const owners: string[] = [];
    for (const m of majiteliaNew.filter(mm => mm.meno)) {
      const parts = m.meno!.split(/\s+a\s+/i).map(n => n.trim()).filter(n => n.length > 2);
      owners.push(...(parts.length > 1 ? parts : [m.meno!]));
    }
    const obecLv = parsed.obec ? String(parsed.obec) : "";
    const ulicaLv = parsed.ulica ? String(parsed.ulica) : "";
    const okresLv = parsed.okres ? String(parsed.okres) : "";
    const supisneLv = parsed.supisne_cislo ? String(parsed.supisne_cislo) : "";
    const adresaLv = [ulicaLv, supisneLv, obecLv].filter(Boolean).join(" ").trim();

    setLvEditOwners(owners);
    setLvEditObec(obecLv);
    setLvEditUlica(ulicaLv);
    setLvEditOkres(okresLv);
    setLvEditPickedOwner(owners[0] || "");
    setLvEditPickedLok(obecLv);
    setLvEditPickedAdresa(adresaLv);
    setLvEditFixName(!!owners.length);
    setLvEditFixLok(!!obecLv);
    setShowLvEditModal(true);
  }

  // Alias pre spätnú kompatibilitu (stará funkcia)
  const openLvEditModalIfNeeded = openLvEditModalAlways;
  const [selectedLvOwner, setSelectedLvOwner] = useState("");
  const [lvReminderShown, setLvReminderShown] = useState(false);
  const [lvUploading, setLvUploading] = useState(false);
  const [lvUploadErr, setLvUploadErr] = useState("");
  const lvFileRef = useRef<HTMLInputElement>(null);
  const [showSpolupracaModal, setShowSpolupracaModal] = useState(false);
  const [spolupracaMakler, setSpolupracaMakler] = useState("");
  const [spolupracaPct, setSpolupracaPct] = useState(50);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [makleri, setMakleri] = useState<{ id: string; meno: string }[]>([]);
  const [myMaklerUuid, setMyMaklerUuid] = useState<string | null>(null);
  const isAdmin = user?.id === "ales";
  const isOwner = isAdmin || (myMaklerUuid && klient?.makler_id === myMaklerUuid);

  useEffect(() => {
    if (id) loadAll();
    if (isAdmin) supabase.from("makleri").select("id, meno").eq("aktivny", true).then(r => setMakleri(r.data ?? []));
    if (user?.id) getMaklerUuid(user.id).then(setMyMaklerUuid);
  }, [id]);

  // Ak sa typ zmení na "kupujuci" počas zobrazeného tabu "nehnutelnosti"
  // (alebo sa otvorí kupujúci s tým tabom), tab v karte už neexistuje —
  // prepni na "objednavky" aby používateľ neostal s prázdnym obsahom.
  useEffect(() => {
    if (klient?.typ === "kupujuci" && activeTab === "nehnutelnosti") {
      setActiveTab("objednavky");
    }
  }, [klient?.typ, activeTab]);

  // 15-minútová pripomienka na LV ak chýba
  useEffect(() => {
    if (!klient || klient.lv_data || lvReminderShown) return;
    if (klient.status !== "dohodnuty_naber") return;
    const timer = setTimeout(() => {
      // Skontroluj znova — mohol sa medzičasom pridať LV
      if (!klient.lv_data) {
        setShowLVPrompt(true);
        setLvReminderShown(true);
      }
    }, 15 * 60 * 1000); // 15 minút
    return () => clearTimeout(timer);
  }, [klient?.status, klient?.lv_data, lvReminderShown]);

  async function loadAll() {
    setLoading(true);

    // Paralelné načítanie
    const [klientRes, naberyRes, objednavkyRes, inzeratyRes, obhliadkyRes, docs, udalostiRes] = await Promise.all([
      supabase.from("klienti").select("*").eq("id", id).single(),
      supabase.from("naberove_listy").select("*").eq("klient_id", id).order("created_at", { ascending: false }),
      supabase.from("objednavky").select("*").eq("klient_id", id).order("created_at", { ascending: false }),
      supabase.from("nehnutelnosti").select("*").eq("klient_id", id).order("created_at", { ascending: false }),
      supabase.from("obhliadky")
        .select("id, datum, status, miesto, kupujuci_meno, kupujuci_klient_id")
        .or(`predavajuci_klient_id.eq.${id},kupujuci_klient_id.eq.${id}`)
        .order("datum", { ascending: false }),
      listKlientDokumenty(id),
      supabase.from("klient_udalosti").select("*").eq("klient_id", id).order("created_at", { ascending: false }),
    ]);

    if (klientRes.data) setKlient(klientRes.data);
    setNabery(naberyRes.data ?? []);
    setObjednavky(objednavkyRes.data ?? []);
    setInzeraty(inzeratyRes.data ?? []);

    // Auto-prechod: nabrany + aktivny inzerat → inzerovany
    const hasAktivnyInzerat = (inzeratyRes.data ?? []).some(n => (n as Record<string, unknown>).status === "aktivny");
    if (klientRes.data?.status === "nabrany" && hasAktivnyInzerat && user?.id) {
      klientUpdate(user.id, id, { status: "inzerovany" });
      setKlient(k => k ? { ...k, status: "inzerovany" as KlientStatus } : k);
      fetch("/api/klient-udalosti", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klient_id: id, typ: "status_zmena", popis: "Nabraný → Inzerovaný", autor: user.id }),
      }).catch(() => {});
    }

    // Zostavenie timeline
    const events: TimelineEvent[] = [];

    // Klient vytvorený
    if (klientRes.data) {
      events.push({
        id: "created",
        type: "system",
        title: "Klient vytvorený",
        detail: `Typ: ${TYP_LABELS[klientRes.data.typ] || klientRes.data.typ}`,
        date: klientRes.data.created_at,
        icon: "👤",
        color: "#3B82F6",
      });
    }

    // Nábery
    (naberyRes.data ?? []).forEach((n: Record<string, unknown>) => {
      events.push({
        id: `naber-${n.id}`,
        type: "naber",
        title: `Náberový list — ${n.typ_nehnutelnosti || "—"}`,
        detail: [
          n.obec ? `📍 ${n.obec}` : null,
          n.plocha ? `${n.plocha} m²` : null,
          n.predajna_cena ? `${Number(n.predajna_cena).toLocaleString("sk")} €` : null,
        ].filter(Boolean).join(" · ") || undefined,
        date: n.created_at as string,
        icon: "📝",
        color: "#8B5CF6",
      });
    });

    // Objednávky
    (objednavkyRes.data ?? []).forEach((o: Record<string, unknown>) => {
      events.push({
        id: `obj-${o.id}`,
        type: "objednavka",
        title: `Objednávka — ${o.druh || "—"}`,
        detail: o.cena_do ? `Max: ${Number(o.cena_do).toLocaleString("sk")} €` : undefined,
        date: o.created_at as string,
        icon: "📋",
        color: "#0891B2",
      });
    });

    // Nehnuteľnosti
    (inzeratyRes.data ?? []).forEach((n: Record<string, unknown>) => {
      const nStatus = String(n.status || "koncept");
      const nAddr = String(n.obec || n.ulica || "bez adresy");
      const nTitle = nStatus === "aktivny"
        ? `Inzerát aktivovaný — ${nAddr}`
        : nStatus === "predany"
          ? `Inzerát predaný — ${nAddr}`
          : `Inzerát vytvorený (koncept) — ${nAddr}`;
      events.push({
        id: `neh-${n.id}`,
        type: "nehnutelnost",
        title: nTitle,
        detail: n.plocha ? `${n.plocha} m²` : undefined,
        date: n.created_at as string,
        icon: nStatus === "aktivny" ? "📰" : "🏡",
        color: nStatus === "aktivny" ? "#10B981" : "#6B7280",
      });
    });

    // Obhliadky — event vytvorenia (AT#16: druhý event príde z klient_udalosti)
    (obhliadkyRes.data ?? []).forEach((o: Record<string, unknown>) => {
      const datumLabel = o.datum
        ? new Date(o.datum as string).toLocaleDateString("sk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
        : "—";
      events.push({
        id: `obl-${o.id}`,
        type: "obhliadka",
        title: `Obhliadka vytvorená${o.kupujuci_meno ? ` — ${o.kupujuci_meno}` : ""}`,
        detail: `${datumLabel}${o.miesto ? ` · ${o.miesto}` : ""}`,
        date: (o.created_at || o.datum) as string,
        icon: "🔑",
        color: "#F59E0B",
      });
    });

    // Dokumenty
    docs.forEach((d: KlientDokument) => {
      if (!d.created_at) return;
      events.push({
        id: `doc-${d.id}`,
        type: "dokument",
        title: `Dokument: ${d.name || d.type || "—"}`,
        detail: undefined,
        date: d.created_at,
        icon: "📄",
        color: "#6B7280",
      });
    });

    // Manuálne udalosti (hovory, poznámky, stretnutia...)
    const TYP_ICONS: Record<string, string> = {
      hovor: "📞", poznamka: "📝", stretnutie: "📅", email: "✉️", status_zmena: "🔄", ine: "💬",
    };
    const TYP_COLORS: Record<string, string> = {
      hovor: "#059669", poznamka: "#6B7280", stretnutie: "#8B5CF6", email: "#0891B2", status_zmena: "#F59E0B", ine: "#6B7280",
    };
    const TYP_LABELS_U: Record<string, string> = {
      hovor: "Hovor", poznamka: "Poznámka", stretnutie: "Stretnutie", email: "Email", status_zmena: "Zmena statusu", ine: "Záznam",
    };
    (udalostiRes.data ?? []).forEach((u: Record<string, unknown>) => {
      const uTyp = u.typ as string;
      const uPopis = String(u.popis || "");
      // Obhliadka-related klient_udalosti → 🔑 ikona
      const isObhliadkaLog = uTyp === "ine" && uPopis.startsWith("Obhliadka");
      events.push({
        id: `ud-${u.id}`,
        type: "udalost",
        title: `${TYP_LABELS_U[uTyp] || "Záznam"}${u.autor ? ` · ${u.autor}` : ""}`,
        detail: uPopis,
        date: u.created_at as string,
        icon: isObhliadkaLog ? "🔑" : (TYP_ICONS[uTyp] || "💬"),
        color: isObhliadkaLog ? "#F59E0B" : (TYP_COLORS[uTyp] || "#6B7280"),
        deletable: true,
      });
    });

    // Sort by date desc
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTimeline(events);
    setLoading(false);
  }

  async function quickSaveUdalost() {
    if (!quickAddTyp || !quickAddText.trim() || !klient) return;
    setQuickAddSaving(true);
    try {
      const popis = (quickAddTyp === "stretnutie" && quickAddDatum)
        ? `${new Date(quickAddDatum).toLocaleString("sk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · ${quickAddText.trim()}`
        : quickAddText.trim();
      const res = await fetch("/api/klient-udalosti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klient_id: klient.id, typ: quickAddTyp, popis, autor: user?.id || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Chyba pri ukladaní záznamu: " + (err.error || res.status));
        return;
      }
      setQuickAddText("");
      setQuickAddTyp(null);
      setQuickAddDatum("");
      await loadAll();
    } finally {
      setQuickAddSaving(false);
    }
  }

  async function deleteUdalost(eventId: string) {
    const realId = eventId.replace(/^ud-/, "");
    await fetch(`/api/klient-udalosti?id=${realId}`, { method: "DELETE" });
    await loadAll();
  }

  if (loading) {
    return (
      <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
        Načítavam klienta...
      </div>
    );
  }

  if (!klient) {
    return (
      <div style={{ padding: "60px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>❌</div>
        <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px" }}>
          Klient nenájdený
        </div>
        <button onClick={() => router.push(backHref)} style={{
          padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
          borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
        }}>
          ← Späť na {backLabel.toLowerCase()}
        </button>
      </div>
    );
  }

  // Status change handler s automatickým workflow
  async function handleStatusChange(newStatus: string) {
    if (!klient) return;
    // nabrany can only be set automatically via náberový list
    if (newStatus === "nabrany") return;
    if (
      (newStatus === "dohodnuty_naber") ||
      (newStatus === "volat_neskor")
    ) {
      setPendingStatus(newStatus);
      setNaberMiesto(klient.lokalita || "");
      // Pre-fill ulica/číslo z poznámky ak existuje
      const addrMatch = klient.poznamka?.match(/Adresa:\s*(.+?)(?:,|\n|$)/);
      if (addrMatch) {
        const parts = addrMatch[1].trim().split(/\s+/);
        const cislo = parts.pop() || "";
        setNaberUlica(parts.join(" "));
        setNaberCislo(/^\d/.test(cislo) ? cislo : "");
        if (!/^\d/.test(cislo)) setNaberUlica(addrMatch[1].trim());
      } else {
        setNaberUlica(""); setNaberCislo("");
      }
      setNaberAddrError("");
      setShowDatePicker(true);
      return;
    }
    // Pre ostatné statusy — len update
    const oldStatus = klient.status;
    if (user?.id) await klientUpdate(user.id, klient.id, { status: newStatus });
    // Log zmeny statusu do timeline
    try {
      await fetch("/api/klient-udalosti", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klient_id: klient.id,
          typ: "status_zmena",
          popis: `${STATUS_LABELS[oldStatus as keyof typeof STATUS_LABELS] || oldStatus} → ${STATUS_LABELS[newStatus as keyof typeof STATUS_LABELS] || newStatus}`,
          autor: user?.id || null,
        }),
      });
    } catch { /* neblokuj hlavnú akciu */ }
    loadAll();
  }

  // Po potvrdení dátumu — vytvor calendar event + update status
  async function handleDateConfirm() {
    if (!klient) return;
    // Validácia ulica + číslo pri dohodnutom nábere
    if (pendingStatus === "dohodnuty_naber") {
      if (!naberUlica.trim() || !naberCislo.trim()) {
        setNaberAddrError("Ulica a číslo sú povinné pri dohodnutom nábere");
        return;
      }
    }
    setNaberAddrError("");
    setCalendarSyncing(true);

    // Generic event mode: pendingStatus null → use eventType
    const isGeneric = !pendingStatus;
    const isVolat = pendingStatus === "volat_neskor" || (isGeneric && eventType === "volat");
    const isNaber = pendingStatus === "dohodnuty_naber" || (isGeneric && eventType === "naber");

    const EVENT_LABELS: Record<string, { label: string; minutes: number }> = {
      volat: { label: "Zavolať", minutes: 15 },
      naber: { label: "Náber", minutes: 60 },
      obhliadka: { label: "Obhliadka", minutes: 45 },
      podpis: { label: "Podpis zmluvy", minutes: 60 },
      fotenie: { label: "Fotenie nehnuteľnosti", minutes: 90 },
      odovzdanie: { label: "Odovzdanie kľúčov", minutes: 30 },
      ine: { label: eventTitle.trim() || "Udalosť", minutes: 60 },
    };
    const evCfg = isGeneric ? EVENT_LABELS[eventType] : (isVolat ? EVENT_LABELS.volat : EVENT_LABELS.naber);
    const durationMs = evCfg.minutes * 60000;

    // 1. Update status a dátum (len ak nie generic)
    if (!isGeneric) {
      const updates: Record<string, unknown> = { status: pendingStatus || "dohodnuty_naber" };
      if (naberDatum && !isVolat) updates.datum_naberu = new Date(naberDatum).toISOString();
      if (!isVolat && naberMiesto) updates.lokalita = naberMiesto;
      // Ulica + číslo pri dohodnutom nábere → pridaj do poznámky
      if (isNaber && naberUlica.trim()) {
        const addrLine = `Adresa: ${naberUlica.trim()} ${naberCislo.trim()}`.trim();
        const existingNote = klient.poznamka || "";
        const cleaned = existingNote.replace(/Adresa:\s*.+/i, "").trim();
        updates.poznamka = cleaned ? `${cleaned}\n${addrLine}` : addrLine;
      }
      if (user?.id) await klientUpdate(user.id, klient.id, updates);
    } else if (isNaber && naberDatum && user?.id) {
      await klientUpdate(user.id, klient.id, { datum_naberu: new Date(naberDatum).toISOString() });
    }

    // 2. Vytvor Google Calendar event — pri zlyhaní upozorni maklera
    if (naberDatum && user?.id) {
      const startDt = new Date(naberDatum).toISOString();
      const endDt = new Date(new Date(naberDatum).getTime() + durationMs).toISOString();
      const result = await createCalendarEvent({
        userId: user.id,
        summary: `${evCfg.label} — ${klient.meno}`,
        start: startDt,
        end: endDt,
        description: [
          !isVolat && naberMiesto && `Adresa: ${naberMiesto}`,
          klient.telefon && `Tel: ${klient.telefon}`,
          klient.email && `Email: ${klient.email}`,
        ].filter(Boolean).join("\n"),
        location: isVolat ? "" : naberMiesto,
      });
      if (result.ok) {
        if (user?.id) await klientUpdate(user.id, klient.id, { calendar_event_id: result.eventId });
      } else {
        notifyCalendarFail(result, klient.meno);
      }
    }

    setCalendarSyncing(false);
    setShowDatePicker(false);

    // Ak typ udalosti = obhliadka → otvor obhliadkový modal s prefill datum/miesto.
    // Maklér ešte doplní meno + telefón kupujúceho a uložia sa údaje do tabuľky obhliadky.
    if (!pendingStatus && eventType === "obhliadka" && naberDatum) {
      setObhliadkaPrefill({ datum: naberDatum, miesto: naberMiesto });
      setShowObhliadkaModal(true);
    }

    // Log dohodnuty_naber / volat_neskor do timeline
    if (!isGeneric && pendingStatus && naberDatum) {
      try {
        const datumLabel = new Date(naberDatum).toLocaleDateString("sk", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const popis = isNaber
          ? `Dohodnutý náber: ${datumLabel}${naberMiesto ? ` · ${naberMiesto}` : ""}${naberUlica.trim() ? ` · ${naberUlica.trim()} ${naberCislo.trim()}` : ""}`
          : `Naplánované volanie: ${datumLabel}`;
        await fetch("/api/klient-udalosti", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ klient_id: klient.id, typ: "status_zmena", popis, autor: user?.id || null }),
        });
        // AT#17: log aj prechod statusu
        const oldLabel = STATUS_LABELS[klient.status as keyof typeof STATUS_LABELS] || klient.status;
        const newLabel = STATUS_LABELS[pendingStatus as keyof typeof STATUS_LABELS] || pendingStatus;
        await fetch("/api/klient-udalosti", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ klient_id: klient.id, typ: "status_zmena", popis: `${oldLabel} → ${newLabel}`, autor: user?.id || null }),
        });
      } catch { /* neblokuj */ }
    }

    // Po dohodnutom nábere: ak klient nemá LV, ukáž prompt
    if (isNaber && !klient.lv_data) {
      setShowLVPrompt(true);
    }
    setPendingStatus(null);
    setNaberDatum("");
    setNaberMiesto("");
    setEventTitle("");
    setEventType("naber");
    loadAll();
  }

  // Workflow progress — v akom kroku je klient
  function getWorkflowStep(): number {
    if (!klient) return 0;
    if (klient.status === "uzavrety") return 4;
    if (inzeraty.length > 0 || (klient.status as string) === "inzerovany") return 3;
    if (klient.status === "nabrany" || nabery.length > 0) return 2;
    if (klient.status === "dohodnuty_naber") return 1;
    return 0;
  }

  const initials = klient.meno.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const statusColor = STATUS_COLORS[klient.status] || "#6B7280";
  const workflowStep = getWorkflowStep();

  // Rýchle nahratie LV priamo z banneru/promptu
  async function handleQuickLvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !klient) return;
    e.target.value = "";
    setLvUploading(true);
    setLvUploadErr("");
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/parse-lv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_base64: base64, filename: file.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const parsed = await res.json();
      if (user?.id) await klientUpdate(user.id, klient.id, { lv_data: parsed });
      setKlient(k => k ? { ...k, lv_data: parsed } : k);
      setShowLVPrompt(false);

      // Calendar update s adresou z LV
      const lv = parsed as Record<string, unknown>;
      const lvAddr = [lv.ulica, lv.supisne_cislo, lv.obec].filter(Boolean).map(String).join(" ").trim();
      const calEventId = (klient as { calendar_event_id?: string | null }).calendar_event_id;
      if (calEventId && user?.id && lvAddr) {
        fetch("/api/google/calendar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id, eventId: calEventId, location: lvAddr,
            description: [`Adresa: ${lvAddr}`, klient.telefon && `Tel: ${klient.telefon}`, klient.email && `Email: ${klient.email}`].filter(Boolean).join("\n"),
          }),
        }).catch(() => {});
      }

      // Unified LV edit modal — hneď po uploade zobrazí dropdown vlastníkov + lokalitu z LV
      openLvEditModalAlways(lv as Record<string, unknown>);
    } catch (err) {
      setLvUploadErr("Chyba pri analýze LV: " + (err as Error).message.slice(0, 120));
    } finally {
      setLvUploading(false);
    }
  }

  const cardSt: React.CSSProperties = {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "14px", padding: "20px",
  };

  // Nehnuteľnosti klienta: každý inzerát + každý orphan náberák (bez inzerátu) = 1 karta.
  // Jednoduché MVP matchovanie: predpokladáme ze všetky náberáky a inzeráty tohto klienta
  // patria k samostatným nehnuteľnostiam; prepojenie sa spresní keď sa vyplní naberak_id.
  type PropertyCard = {
    key: string;
    titulok: string;
    podtitulok?: string;
    status: "aktivny" | "koncept" | "predany" | "archivovany" | "pripravujeme";
    cena?: number | null;
    inzerat?: Record<string, unknown> | null;
    naberak?: Record<string, unknown> | null;
  };
  const propertyCards: PropertyCard[] = (() => {
    const cards: PropertyCard[] = [];
    const linkedNaberakIds = new Set<string>();
    // 1. Každý inzerát = jedna karta, s náberákom ak ho má
    for (const inz of inzeraty) {
      const inzRec = inz as Record<string, unknown>;
      const nid = inzRec.naberak_id as string | null;
      const linkedNab = nid ? nabery.find(n => (n as Record<string, unknown>).id === nid) : null;
      // Fallback: ak nie je naberak_id, priraď najnovší ešte neprepojený
      const fallback = !linkedNab ? nabery.find(n => !linkedNaberakIds.has((n as Record<string, unknown>).id as string)) : null;
      const naberak = linkedNab || fallback || null;
      if (naberak) linkedNaberakIds.add((naberak as Record<string, unknown>).id as string);
      const ulica = String(inzRec.ulica_privatna || inzRec.ulica || "");
      const izby = inzRec.izby ? `${inzRec.izby}-izb` : "";
      cards.push({
        key: `inz-${inzRec.id}`,
        titulok: (inzRec.nazov as string) || [ulica, izby].filter(Boolean).join(", ") || "Nehnuteľnosť",
        podtitulok: (inzRec.lokalita as string) || undefined,
        status: (inzRec.status as PropertyCard["status"]) || "koncept",
        cena: inzRec.cena as number | null,
        inzerat: inzRec,
        naberak,
      });
    }
    // 2. Orphan náberáky (nemajú inzerát) = samostatné "pripravujeme" karty
    for (const nab of nabery) {
      const nRec = nab as Record<string, unknown>;
      if (linkedNaberakIds.has(nRec.id as string)) continue;
      const ulica = String(nRec.ulica || "");
      const params = (nRec.parametre || {}) as Record<string, unknown>;
      const izby = params.pocet_izieb ? `${params.pocet_izieb}-izb` : "";
      cards.push({
        key: `nab-${nRec.id}`,
        titulok: [ulica, izby].filter(Boolean).join(", ") || "Nehnuteľnosť (náberák)",
        podtitulok: [nRec.obec, nRec.okres].filter(Boolean).join(", ") || undefined,
        status: "pripravujeme",
        cena: nRec.predajna_cena as number | null,
        inzerat: null,
        naberak: nRec,
      });
    }
    return cards;
  })();

  // Pre čistého kupujúceho (typ="kupujuci") skryjeme tab "Nehnuteľnosti" —
  // kupujuci predáva nič, iba kupuje. Nábery, LV a vlastné inzeráty sa ho
  // netýkajú; relevantnejšie tým je sekcia Objednávky (čo hľadá).
  const isCistyKupujuci = klient.typ === "kupujuci";
  const tabs = [
    { key: "timeline", label: "Aktivita", count: timeline.length },
    ...(isCistyKupujuci ? [] : [{ key: "nehnutelnosti", label: "Nehnuteľnosti", count: propertyCards.length }]),
    { key: "obhliadky", label: "Obhliadky", count: obhliadky.length },
    { key: "objednavky", label: "Objednávky", count: objednavky.length },
    { key: "dokumenty", label: "Dokumenty", count: 0 },
    { key: "historia", label: "CRM Log", count: 0 },
  ];

  // Dáta pre ClientInsightPanel
  const prvaNehn = inzeraty[0] as Record<string, unknown> | undefined;
  const prvyNab = nabery[0] as Record<string, unknown> | undefined;
  const nehnutelnostIdForPanel = prvaNehn?.id as string | null ?? null;
  const predajnaCenaForPanel = (prvyNab?.predajna_cena ?? prvaNehn?.cena) as number | null ?? null;
  const prvaObj = objednavky[0] as Record<string, unknown> | undefined;
  const objednavkaIdForPanel = prvaObj?.id as string | null ?? null;
  const cenaDo = prvaObj?.cena_do as number | null ?? null;
  const cenaOd = prvaObj?.cena_od as number | null ?? null;
  const showInsightPanel = !!nehnutelnostIdForPanel || !!objednavkaIdForPanel
    || klient.typ === "kupujuci" || klient.typ === "oboje";

  return (
    <div style={{ maxWidth: "1280px" }}>
      <div style={wideLayout ? { display: "flex", gap: "24px", alignItems: "flex-start" } : { display: "block" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header */}
      {/* Breadcrumb navigácia */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", fontSize: "13px" }}>
        <a href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>🏠 Prehľad</a>
        <span style={{ color: "var(--text-muted)" }}>›</span>
        <a href={backHref} style={{ color: "var(--text-muted)", textDecoration: "none" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>{backLabel}</a>
        <span style={{ color: "var(--text-muted)" }}>›</span>
        <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{klient.meno}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <button onClick={() => router.push(backHref)} style={{
          width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--border)",
          background: "var(--bg-surface)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>←</button>
        <div style={{ flex: 1, minWidth: "160px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
            Karta klienta
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Všetky informácie a história
          </p>
        </div>
        {isOwner ? (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Toggle typu klienta — predavajuci/kupujuci/oboje. Maklér môže
                jednoducho doplniť alebo zúžiť rolu klienta bez nutnosti otvárať
                úpravu. Tlačidlá sa menia podľa aktuálneho typu (jeden klik =
                jedna logická akcia). */}
            {klient.typ === "predavajuci" && (
              <button onClick={async () => {
                if (!confirm(`Doplniť ${klient.meno} aj ako kupujúceho?\n\nObjaví sa aj v sekcii Kupujúci.`)) return;
                if (user?.id) await klientUpdate(user.id, klient.id, { typ: "oboje" });
                loadAll();
              }} style={{
                padding: "9px 14px", background: "#ECFDF5", color: "#065F46",
                border: "1px solid #A7F3D0", borderRadius: "10px", fontSize: "13px",
                fontWeight: "600", cursor: "pointer",
              }} title="Klient sa doplní aj ako kupujúci (zostane aj predávajúcim)">
                + aj kupujúci
              </button>
            )}
            {klient.typ === "kupujuci" && (
              <button onClick={async () => {
                if (!confirm(`Doplniť ${klient.meno} aj ako predávajúceho?\n\nObjaví sa aj v sekcii Klienti.`)) return;
                if (user?.id) await klientUpdate(user.id, klient.id, { typ: "oboje" });
                loadAll();
              }} style={{
                padding: "9px 14px", background: "#EFF6FF", color: "#1E40AF",
                border: "1px solid #BFDBFE", borderRadius: "10px", fontSize: "13px",
                fontWeight: "600", cursor: "pointer",
              }} title="Klient sa doplní aj ako predávajúci (zostane aj kupujúcim)">
                + aj predávajúci
              </button>
            )}
            {klient.typ === "oboje" && (
              <>
                <button onClick={async () => {
                  if (!confirm(`Nechať ${klient.meno} iba ako kupujúceho?\n\nZmizne zo sekcie Klienti.`)) return;
                  if (user?.id) await klientUpdate(user.id, klient.id, { typ: "kupujuci" });
                  loadAll();
                }} style={{
                  padding: "9px 14px", background: "#ECFDF5", color: "#065F46",
                  border: "1px solid #A7F3D0", borderRadius: "10px", fontSize: "13px",
                  fontWeight: "600", cursor: "pointer",
                }}>iba kupujúci</button>
                <button onClick={async () => {
                  if (!confirm(`Nechať ${klient.meno} iba ako predávajúceho?\n\nZmizne zo sekcie Kupujúci.`)) return;
                  if (user?.id) await klientUpdate(user.id, klient.id, { typ: "predavajuci" });
                  loadAll();
                }} style={{
                  padding: "9px 14px", background: "#EFF6FF", color: "#1E40AF",
                  border: "1px solid #BFDBFE", borderRadius: "10px", fontSize: "13px",
                  fontWeight: "600", cursor: "pointer",
                }}>iba predávajúci</button>
              </>
            )}
            <button onClick={() => setEditModal(true)} style={{
              padding: "9px 18px", background: "var(--bg-surface)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px",
              fontWeight: "600", cursor: "pointer",
            }}>
              ✏️ Upraviť
            </button>
            {/* Manuálne uvoľnenie klienta (vrátenie do voľného poolu) */}
            {!klient.je_volny && (klient as { anonymized_at?: string | null }).anonymized_at == null && (
              <button onClick={async () => {
                if (!confirm(`Uvoľniť klienta ${klient.meno}? Stane sa voľným pre celú kanceláriu.`)) return;
                if (user?.id) await klientUpdate(user.id, klient.id, {
                  je_volny: true,
                  volny_dovod: klient.status,
                  volny_at: new Date().toISOString(),
                });
                await supabase.from("klienti_history").insert({
                  klient_id: klient.id,
                  action: "uvolneny",
                  from_makler_id: klient.makler_id,
                  by_user_id: user?.id,
                  dovod: "Manuálne uvoľnenie maklerom",
                });
                window.location.reload();
              }} style={{
                padding: "9px 14px", background: "var(--bg-surface)", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px",
                fontWeight: "600", cursor: "pointer",
              }} title="Vráti klienta do voľného poolu (môže si ho prebrať iný maklér)">
                Uvoľniť klienta
              </button>
            )}
            {!(klient as { anonymized_at?: string | null }).anonymized_at && (
              <button onClick={async () => {
                const ok = window.confirm(
                  "Naozaj anonymizovať tohto klienta?\n\n" +
                  "Meno, telefón, email a poznámky budú nenávratne zmazané (právo " +
                  "na zabudnutie podľa GDPR čl. 17). Náberáky a obhliadky zostanú " +
                  "evidované, ale bez identifikovateľných údajov.\n\nOperácia je nevratná."
                );
                if (!ok) return;
                const r = await fetch("/api/klienti/anonymize", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: klient.id }),
                });
                if (!r.ok) { alert("Chyba pri anonymizácii"); return; }
                window.location.reload();
              }} style={{
                padding: "9px 14px", background: "var(--bg-surface)", color: "#B91C1C",
                border: "1px solid #FECACA", borderRadius: "10px", fontSize: "12px",
                fontWeight: "600", cursor: "pointer",
              }} title="Právo na zabudnutie podľa GDPR čl. 17">
                Anonymizovať (GDPR)
              </button>
            )}
            {(klient as { anonymized_at?: string | null }).anonymized_at && (
              <span style={{
                padding: "9px 14px", background: "#F3F4F6", color: "#6B7280",
                border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px",
                fontWeight: "600",
              }}>Anonymizovaný {new Date((klient as { anonymized_at: string }).anonymized_at).toLocaleDateString("sk")}</span>
            )}
          </div>
        ) : (
          <div style={{
            padding: "9px 14px", background: "#FEF3C7", color: "#92400E",
            border: "1px solid #FDE68A", borderRadius: "10px", fontSize: "12px",
            fontWeight: "600", display: "flex", alignItems: "center", gap: "6px",
          }}>
            🔒 Len na čítanie — klient iného makléra
          </div>
        )}
      </div>

      {/* SLA Timer banner — odpočítava do uvolnenia / SLA warningu */}
      <SlaTimer klient={klient} hasInzerat={inzeraty.length > 0} />

      {/* Klient karta — hlavné info */}
      {/* ═══ LV mismatch banner — VŽDY VIDITEĽNÝ keď LV existuje a údaje klienta sa nezhodujú ═══ */}
      {klient.lv_data && isOwner && (() => {
        const lv = klient.lv_data as Record<string, unknown>;
        const majiteliaArr = (lv.majitelia as Array<{ meno?: string }> | undefined) ?? [];
        const owners: string[] = [];
        for (const m of majiteliaArr.filter(mm => mm.meno)) {
          const parts = m.meno!.split(/\s+a\s+/i).map(n => n.trim()).filter(n => n.length > 2);
          owners.push(...(parts.length > 1 ? parts : [m.meno!]));
        }
        const obecLv = lv.obec ? String(lv.obec) : "";
        const nameCur = (klient.meno || "").trim().toLowerCase();
        const nameOk = !nameCur || owners.length === 0 ||
          owners.some(n => n.toLowerCase() === nameCur || nameCur.includes(n.toLowerCase()) || n.toLowerCase().includes(nameCur));
        const locCur = (klient.lokalita || "").trim().toLowerCase();
        const locOk = !obecLv || !locCur || locCur === obecLv.toLowerCase() ||
          locCur.includes(obecLv.toLowerCase()) || obecLv.toLowerCase().includes(locCur);

        if (nameOk && locOk) return null;

        return (
          <div style={{
            marginBottom: "16px", padding: "14px 18px",
            background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "12px",
            display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "20px" }}>⚠️</span>
            <div style={{ flex: 1, minWidth: "250px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#92400E", marginBottom: "2px" }}>
                Údaje klienta sa nezhodujú s LV
              </div>
              <div style={{ fontSize: "12px", color: "#92400E" }}>
                {!nameOk && <>Meno: <strong>{klient.meno}</strong> vs LV: <strong>{owners[0]}</strong>{owners.length > 1 ? ` (+${owners.length - 1})` : ""}</>}
                {!nameOk && !locOk && <> · </>}
                {!locOk && <>Lokalita: <strong>{klient.lokalita || "—"}</strong> vs LV: <strong>{obecLv}</strong></>}
              </div>
            </div>
            <button onClick={() => {
              const okres = lv.okres ? String(lv.okres) : "";
              setLvEditOwners(owners);
              setLvEditObec(obecLv);
              setLvEditOkres(okres);
              setLvEditPickedOwner(owners[0] || "");
              setLvEditPickedLok(obecLv);
              setLvEditFixName(!nameOk);
              setLvEditFixLok(!locOk);
              setShowLvEditModal(true);
            }} style={{
              padding: "8px 16px", background: "#D97706", color: "#fff",
              border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}>Upraviť podľa LV</button>
          </div>
        );
      })()}

      <div style={{
        ...cardSt, marginBottom: "20px",
        display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "20px", alignItems: "center",
      }} className="dash-grid">
        {/* Avatar */}
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: "var(--bg-elevated)", color: "var(--text-secondary)",
          border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "20px", fontWeight: "700", flexShrink: 0, letterSpacing: "0.02em",
        }}>{initials}</div>

        {/* Info */}
        <div>
          <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
            {klient.meno}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
            {klient.telefon && (
              <a href={`tel:${klient.telefon}`} style={{ color: "var(--text-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                📱 {klient.telefon}
              </a>
            )}
            {klient.email && (
              <a href={`mailto:${klient.email}`} style={{ color: "var(--text-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                ✉️ {klient.email}
              </a>
            )}
            {(() => {
              // Adresy z nehnuteľností klienta (ulica + číslo + obec). Ak nie sú,
              // padneme na klient.lokalita. Ak má klient viac nehnuteľností na
              // rôznych adresách, ukážeme všetky oddelené pomlčkami.
              const adresyZnehn: string[] = [];
              for (const inz of inzeraty) {
                const rec = inz as Record<string, unknown>;
                const ulica = String(rec.ulica_privatna || rec.ulica || "").trim();
                const obec = String(rec.obec || rec.lokalita || "").trim();
                if (ulica) adresyZnehn.push(obec ? `${ulica} · ${obec}` : ulica);
              }
              for (const nab of nabery) {
                const rec = nab as Record<string, unknown>;
                const ulica = String(rec.ulica || "").trim();
                const cislo = String(rec.cislo_orientacne || "").trim();
                const obec = String(rec.obec || "").trim();
                if (ulica) {
                  const full = [`${ulica}${cislo ? ` ${cislo}` : ""}`, obec].filter(Boolean).join(" · ");
                  if (!adresyZnehn.some(a => a.toLowerCase().includes(ulica.toLowerCase()))) {
                    adresyZnehn.push(full);
                  }
                }
              }
              const unique = Array.from(new Set(adresyZnehn));
              const toShow = unique.length > 0 ? unique : (klient.lokalita ? [klient.lokalita] : []);
              if (toShow.length === 0) return null;
              return toShow.map((a, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  📍 {a}
                </span>
              ));
            })()}
          </div>
          {(() => {
            const odkazMatch = klient.poznamka?.match(/Odkaz:\s*(https?:\/\/\S+)/);
            if (!odkazMatch) return null;
            return (
              <div style={{ marginTop: "6px" }}>
                <a href={odkazMatch[1]} target="_blank" rel="noopener" style={{
                  fontSize: "12px", color: "#3B82F6", textDecoration: "none",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                  🔗 {odkazMatch[1].substring(0, 60)}...
                </a>
              </div>
            );
          })()}
        </div>

        {/* Status + Typ badges */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
          <select
            value={klient.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={!isOwner}
            style={{
              padding: "6px 28px 6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "700",
              background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)",
              cursor: isOwner ? "pointer" : "default", appearance: "none",
              opacity: isOwner ? 1 : 0.7,
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
              outline: "none",
            }}
          >
            {[
              { value: "aktivny", label: "Aktívny" },
              { value: "novy_kontakt", label: "Nový kontakt" },
              { value: "dohodnuty_naber", label: "Dohodnutý náber" },
              ...(klient.status === "nabrany" ? [{ value: "nabrany", label: "Nabraný" }] : []),
              { value: "volat_neskor", label: "Volať neskôr" },
              { value: "nedovolal", label: "Nedovolal" },
              { value: "nechce_rk", label: "Nechce RK" },
              { value: "uz_predal", label: "Už predal" },
              { value: "realitna_kancelaria", label: "Realitná kancelária" },
            ].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span style={{
            padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "600",
            background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)",
          }}>
            {TYP_LABELS[klient.typ] || klient.typ}
          </span>
          {/* Admin: assign makler */}
          {isAdmin && makleri.length > 0 && (
            <select
              value={klient.makler_id || ""}
              onChange={async (e) => {
                if (user?.id) await klientUpdate(user.id, klient.id, { makler_id: e.target.value || null });
                loadAll();
              }}
              style={{
                padding: "4px 24px 4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)",
                cursor: "pointer", appearance: "none", outline: "none",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center",
              }}
            >
              <option value="">Bez maklera</option>
              {makleri.map(m => <option key={m.id} value={m.id}>{m.meno}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Spolupráca */}
      {isOwner && makleri.length > 0 && (
        <div style={{ ...cardSt, marginBottom: "20px", padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Spolupráca
            </div>
            {!klient.spolupracujuci_makler_id && (
              <button onClick={() => setShowSpolupracaModal(true)} style={{
                padding: "4px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)",
                cursor: "pointer",
              }}>+ Pridať maklera</button>
            )}
          </div>
          {klient.spolupracujuci_makler_id ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%", background: "#E5E7EB",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", color: "#374151",
              }}>
                {(makleri.find(m => m.id === klient.spolupracujuci_makler_id)?.meno || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
                  {makleri.find(m => m.id === klient.spolupracujuci_makler_id)?.meno || "Neznámy"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Podiel z provízie: {klient.spolupracujuci_provizia_pct ?? 50}%
                </div>
              </div>
              {isOwner && (
                <button onClick={async () => {
                  if (user?.id) await klientUpdate(user.id, klient.id, { spolupracujuci_makler_id: null, spolupracujuci_provizia_pct: null });
                  loadAll();
                }} style={{
                  padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "700",
                  background: "#FEE2E2", color: "#991B1B", border: "none", cursor: "pointer",
                }}>Odstrániť</button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
              Žiadna spolupráca. Pridajte maklera a nastavte podiel z provízie.
            </div>
          )}
        </div>
      )}

      {/* Workflow progress */}
      {(klient.typ === "predavajuci" || klient.typ === "oboje" || klient.typ === "prenajimatel") && (
        <div style={{ ...cardSt, marginBottom: "20px", padding: "16px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Pipeline predávajúceho
          </div>
          {/* 9 krokov v jednom riadku */}
          {(() => {
            const STEP_HANDLERS: ((() => void) | null)[] = [
              isOwner ? () => handleStatusChange("novy_kontakt") : null,
              isOwner ? () => handleStatusChange("dohodnuty_naber") : null,
              null,
              null,
              () => setShowObhliadkaModal(true),
              null,
              null,
              null,
              isOwner ? () => handleStatusChange("uzavrety") : null,
            ];
            return (
              <div style={{ overflowX: "auto", overflowY: "visible", paddingBottom: "6px", scrollbarWidth: "thin", scrollbarColor: "#374151 var(--border)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", minWidth: "max-content", gap: "0", paddingBottom: "2px" }}>
                  {COMBINED_STEPS.map((step, i) => {
                    let isCompleted: boolean;
                    let isCurrent: boolean;
                    if (i <= 3) {
                      isCompleted = workflowStep > i;
                      isCurrent = workflowStep === i;
                    } else if (i === 8) {
                      isCompleted = false;
                      isCurrent = workflowStep >= 4;
                    } else {
                      isCompleted = false;
                      isCurrent = workflowStep === 3 && i === 4;
                    }
                    const handler = STEP_HANDLERS[i];
                    const isClickable = handler !== null && !isCurrent;
                    return (
                      <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "80px" }}>
                          <div style={{
                            width: isCurrent ? "56px" : "48px",
                            height: isCurrent ? "56px" : "48px",
                            borderRadius: "50%",
                            background: isCurrent ? "rgba(55,65,81,0.08)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s",
                          }}>
                            <div
                              onClick={isClickable ? handler! : undefined}
                              style={{
                                width: "40px", height: "40px", borderRadius: "50%",
                                background: isCompleted || isCurrent ? "#374151" : "var(--bg-elevated)",
                                color: isCompleted || isCurrent ? "#fff" : "var(--text-muted)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: isCompleted ? "16px" : "14px", fontWeight: "700",
                                border: isCompleted || isCurrent ? "none" : "1.5px solid var(--border)",
                                transition: "all 0.2s",
                                cursor: isClickable ? "pointer" : "default",
                                flexShrink: 0,
                              }}
                            >
                              {isCompleted ? "✓" : i + 1}
                            </div>
                          </div>
                          <span onClick={isClickable ? handler! : undefined} style={{
                            fontSize: "11px", fontWeight: isCurrent ? "700" : "500",
                            color: isCurrent ? "var(--text-primary)" : "var(--text-muted)",
                            textAlign: "center", lineHeight: "1.3",
                            cursor: isClickable ? "pointer" : "default",
                            whiteSpace: "nowrap",
                          }}>{step.label}</span>
                        </div>
                        {i < COMBINED_STEPS.length - 1 && (
                          <div style={{
                            height: "1.5px", width: "32px", flexShrink: 0,
                            background: isCompleted ? "#374151" : "var(--border)",
                            marginBottom: "28px", borderRadius: "1px",
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {/* Akčné tlačidlo podľa kroku */}
          {workflowStep === 0 && (
            <button onClick={() => handleStatusChange("dohodnuty_naber")} style={{
              marginTop: "14px", width: "100%", padding: "11px", background: "#374151", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>🤝 Dohodnúť náber</button>
          )}
          {workflowStep === 1 && (
            <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)} style={{
              marginTop: "14px", width: "100%", padding: "11px", background: "#374151", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>📝 Vyplniť náberový list</button>
          )}
          {workflowStep === 2 && (
            nabery.length === 0 ? (
              <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)} style={{
                marginTop: "14px", width: "100%", padding: "11px", background: "#374151", color: "#fff",
                border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>📝 Vyplniť náberový list</button>
            ) : isAdmin && (
              <button onClick={() => router.push(`/inzerat?klient_id=${klient.id}`)} style={{
                marginTop: "14px", width: "100%", padding: "11px", background: "#374151", color: "#fff",
                border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>📰 Vytvoriť inzerát</button>
            )
          )}
          {workflowStep === 3 && (
            <button onClick={() => setShowObhliadkaModal(true)} style={{
              marginTop: "14px", width: "100%", padding: "11px", background: "#374151", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>📅 Pridať obhliadku</button>
          )}
          {klient.datum_naberu && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
              📅 Termín náberu: {new Date(klient.datum_naberu).toLocaleString("sk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      )}

      {/* LV banner — dohodnutý náber bez LV — priamy upload */}
      {klient.status === "dohodnuty_naber" && !klient.lv_data && (
        <div style={{
          ...cardSt, marginBottom: "20px", padding: "14px 20px",
          background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
          border: "1px solid #F59E0B",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#92400E" }}>List vlastníctva chýba</div>
              <div style={{ fontSize: "12px", color: "#A16207" }}>
                {lvUploading ? "Analyzujem LV..." : "Nahraj PDF alebo fotku LV"}
              </div>
            </div>
            <label style={{
              padding: "8px 16px", background: lvUploading ? "#B45309" : "#92400E", color: "#fff", border: "none",
              borderRadius: "8px", fontSize: "12px", fontWeight: "600",
              cursor: lvUploading ? "default" : "pointer", whiteSpace: "nowrap",
              opacity: lvUploading ? 0.7 : 1,
            }}>
              {lvUploading ? "⏳ Analyzujem..." : "📎 Nahrať LV"}
              <input type="file" accept=".pdf,image/*" onChange={handleQuickLvUpload} style={{ display: "none" }} disabled={lvUploading} />
            </label>
          </div>
          {lvUploadErr && (
            <div style={{ fontSize: "12px", color: "#991B1B", marginTop: "8px" }}>{lvUploadErr}</div>
          )}
        </div>
      )}

      {/* LV prompt modal — po potvrdení náberu — priamy upload */}
      {showLVPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setShowLVPrompt(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "20px", padding: "32px",
            maxWidth: "400px", width: "100%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📄</div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px" }}>
              Pridať List vlastníctva
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px", lineHeight: "1.5" }}>
              LV automaticky vyplní adresu, vlastníkov a ťarchy do náberového listu.
            </p>
            {lvUploading ? (
              <div style={{ padding: "16px", background: "var(--bg-elevated)", borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)" }}>
                ⏳ Analyzujem LV...
              </div>
            ) : (
              <>
                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  padding: "14px 24px", background: "#374151", color: "#fff", border: "none",
                  borderRadius: "12px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
                  marginBottom: "10px", width: "100%",
                }}>
                  📎 Nahrať LV (PDF alebo fotka)
                  <input type="file" accept=".pdf,image/*" onChange={handleQuickLvUpload} style={{ display: "none" }} />
                </label>
                <button onClick={() => setShowLVPrompt(false)} style={{
                  padding: "10px 24px", background: "transparent", color: "var(--text-muted)",
                  border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "500", cursor: "pointer",
                }}>Neskôr</button>
              </>
            )}
            {lvUploadErr && (
              <div style={{ fontSize: "12px", color: "#EF4444", marginTop: "10px" }}>{lvUploadErr}</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Unified LV edit modal — vyskakuje HNEĎ po LV uploade bez ohľadu na tab ═══ */}
      {showLvEditModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => !lvEditSaving && setShowLvEditModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "20px", padding: "28px",
            maxWidth: "480px", width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "22px" }}>📋</span>
              <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                LV analyzovaný — upraviť klienta?
              </h2>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 18px" }}>
              Údaje klienta sa líšia od LV. Vyber čo chceš prepísať.
            </p>

            {lvEditOwners.length > 0 && (
              <div style={{ marginBottom: "14px", padding: "12px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={lvEditFixName} onChange={(e) => setLvEditFixName(e.target.checked)}
                    style={{ marginTop: "3px", cursor: "pointer" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                      Premenovať klienta
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
                      Z &quot;{klient.meno || "—"}&quot; na vlastníka z LV:
                    </div>
                    <select value={lvEditPickedOwner} onChange={(e) => setLvEditPickedOwner(e.target.value)} disabled={!lvEditFixName}
                      style={{ width: "100%", padding: "8px 12px", fontSize: "13px", fontWeight: 600,
                        background: "var(--bg-surface)", color: "var(--text-primary)",
                        border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer",
                        opacity: lvEditFixName ? 1 : 0.5 }}>
                      {lvEditOwners.map((n, i) => <option key={i} value={n}>{n}</option>)}
                    </select>
                  </div>
                </label>
              </div>
            )}

            {lvEditObec && (
              <div style={{ marginBottom: "14px", padding: "12px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={lvEditFixLok} onChange={(e) => setLvEditFixLok(e.target.checked)}
                    style={{ marginTop: "3px", cursor: "pointer" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                      Lokalita nehnuteľnosti (obec)
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
                      Z LV — nie adresa vlastníka:
                    </div>
                    <input type="text" value={lvEditPickedLok} onChange={(e) => setLvEditPickedLok(e.target.value)} disabled={!lvEditFixLok}
                      style={{ width: "100%", padding: "8px 12px", fontSize: "13px", fontWeight: 600,
                        background: "var(--bg-surface)", color: "var(--text-primary)",
                        border: "1px solid var(--border)", borderRadius: "8px",
                        opacity: lvEditFixLok ? 1 : 0.5 }} />
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Súčasná: &quot;{klient.lokalita || "—"}&quot;{lvEditOkres ? ` · okres ${lvEditOkres}` : ""}
                    </div>
                  </div>
                </label>
              </div>
            )}

            {lvEditPickedAdresa && (
              <div style={{ marginBottom: "18px", padding: "12px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                  📍 Presná adresa nehnuteľnosti (do kalendára)
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
                  Táto adresa pôjde do udalosti v Google Kalendári. Je to správne?
                </div>
                <input type="text" value={lvEditPickedAdresa} onChange={(e) => setLvEditPickedAdresa(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", fontSize: "13px", fontWeight: 600,
                    background: "var(--bg-surface)", color: "var(--text-primary)",
                    border: "1px solid var(--border)", borderRadius: "8px" }} />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Uprav podľa potreby (napr. pridaj orientačné číslo, psč…)
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowLvEditModal(false)} disabled={lvEditSaving} style={{
                flex: 1, padding: "10px", background: "var(--bg-elevated)", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "10px",
                fontSize: "13px", fontWeight: 600, cursor: lvEditSaving ? "default" : "pointer",
              }}>Ponechať pôvodné</button>
              <button
                onClick={async () => {
                  if (!klient) return;
                  setLvEditSaving(true);
                  try {
                    const updates: Record<string, unknown> = {};
                    if (lvEditFixName && lvEditPickedOwner) updates.meno = lvEditPickedOwner;
                    if (lvEditFixLok && lvEditPickedLok) updates.lokalita = lvEditPickedLok;
                    if (Object.keys(updates).length > 0 && user?.id) {
                      await klientUpdate(user.id, klient.id, updates);
                      setKlient(k => k ? { ...k, ...updates } as Klient : k);
                    }
                    // Sync kalendár event — VŽDY keď máme calEventId (aj adresa sa updatuje)
                    const calEventId = (klient as { calendar_event_id?: string | null }).calendar_event_id;
                    if (calEventId && user?.id) {
                      const finalMeno = updates.meno || klient.meno;
                      const isNaber = klient.status === "dohodnuty_naber" || klient.status === "nabrany";
                      const prefix = isNaber ? "Náber" : "Zavolať";
                      const calPayload: Record<string, unknown> = {
                        userId: user.id, eventId: calEventId,
                        summary: `${prefix} — ${finalMeno}`,
                      };
                      if (lvEditPickedAdresa) {
                        calPayload.location = lvEditPickedAdresa;
                        calPayload.description = [
                          `Adresa: ${lvEditPickedAdresa}`,
                          klient.telefon && `Tel: ${klient.telefon}`,
                          klient.email && `Email: ${klient.email}`,
                        ].filter(Boolean).join("\n");
                      }
                      fetch("/api/google/calendar", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(calPayload),
                      }).catch(() => {});
                    }
                    setShowLvEditModal(false);
                  } finally { setLvEditSaving(false); }
                }}
                disabled={lvEditSaving}
                style={{
                  flex: 1, padding: "10px", background: "#374151", color: "#fff",
                  border: "none", borderRadius: "10px",
                  fontSize: "13px", fontWeight: 600,
                  cursor: lvEditSaving ? "default" : "pointer",
                  opacity: lvEditSaving ? 0.5 : 1,
                }}>{lvEditSaving ? "Ukladám..." : "Uložiť"}</button>
            </div>
          </div>
        </div>
      )}

      {/* LV diff modal — porovnanie LV vs existujúce údaje */}
      {showLVDiff && lvDiff.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setShowLVDiff(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "20px", padding: "32px",
            maxWidth: "480px", width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "24px" }}>⚠️</span>
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                  Nesúlad údajov
                </h2>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                  LV obsahuje iné údaje než sú pri klientovi
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {lvDiff.map((d, i) => (
                <div key={i} style={{
                  padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>{d.label}</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ color: "#EF4444", textDecoration: "line-through", flex: 1 }}>{d.old}</span>
                    <span style={{ color: "var(--text-muted)" }}>→</span>
                    <span style={{ color: "#059669", fontWeight: "600", flex: 1 }}>{d.new_}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowLVDiff(false)} style={{
                padding: "10px 20px", background: "var(--bg-elevated)", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>Ponechať pôvodné</button>
              <button onClick={async () => {
                // Aktualizuj klienta údajmi z LV
                const updates: Record<string, unknown> = {};
                const lv = klient.lv_data as Record<string, unknown> | null;
                if (lv) {
                  for (const d of lvDiff) {
                    if (d.field === "lokalita" && lv.obec) updates.lokalita = String(lv.obec);
                    if (d.field === "adresa") {
                      const addrLine = `Adresa: ${[lv.ulica, lv.supisne_cislo, lv.obec].filter(Boolean).map(String).join(" ")}`;
                      const existing = klient.poznamka || "";
                      const cleaned = existing.replace(/Adresa:\s*.+/i, "").trim();
                      updates.poznamka = cleaned ? `${cleaned}\n${addrLine}` : addrLine;
                    }
                  }
                }
                if (Object.keys(updates).length > 0 && user?.id) {
                  await klientUpdate(user.id, klient.id, updates);
                  setKlient(k => k ? { ...k, ...updates } as typeof k : k);
                }
                setShowLVDiff(false);
              }} style={{
                padding: "10px 20px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>Aktualizovať podľa LV</button>
            </div>
          </div>
        </div>
      )}

      {/* LV Rename modal */}
      {showLVRename && lvOwnerNames.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setShowLVRename(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "20px", padding: "32px",
            maxWidth: "420px", width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "24px" }}>👤</span>
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                  Premenovať klienta?
                </h2>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                  Meno &quot;{klient.meno}&quot; nezodpovedá vlastníkom z LV
                </p>
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                Vyber vlastníka z LV
              </label>
              <select value={selectedLvOwner} onChange={e => setSelectedLvOwner(e.target.value)} style={{
                width: "100%", padding: "12px 14px", fontSize: "14px", fontWeight: "600",
                background: "var(--bg-elevated)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: "10px",
                appearance: "auto", cursor: "pointer",
              }}>
                {lvOwnerNames.map((name, i) => (
                  <option key={i} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowLVRename(false)} style={{
                flex: 1, padding: "10px 20px", background: "var(--bg-elevated)", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>Ponechať &quot;{klient.meno}&quot;</button>
              <button onClick={async () => {
                if (!selectedLvOwner || !user?.id) return;
                await klientUpdate(user.id, klient.id, { meno: selectedLvOwner });
                // Aktualizuj Google Calendar event s novým menom
                const calEventId = (klient as { calendar_event_id?: string | null }).calendar_event_id;
                if (calEventId && user?.id) {
                  try {
                    const isNaber = klient.status === "dohodnuty_naber" || klient.status === "nabrany";
                    const prefix = isNaber ? "Náber" : "Zavolať";
                    await fetch("/api/google/calendar", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userId: user.id,
                        eventId: calEventId,
                        summary: `${prefix} — ${selectedLvOwner}`,
                        description: [
                          klient.telefon && `Tel: ${klient.telefon}`,
                          klient.email && `Email: ${klient.email}`,
                        ].filter(Boolean).join("\n"),
                      }),
                    });
                  } catch { /* calendar update silent */ }
                }
                setKlient(k => k ? { ...k, meno: selectedLvOwner } : k);
                setShowLVRename(false);
              }} style={{
                flex: 1, padding: "10px 20px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>Premenovať</button>
            </div>
          </div>
        </div>
      )}

      {/* Rýchle akcie — Inzerát/Vyplniť náberák odstránené, pracujú sa cez Pipeline predávajúceho */}
      <div style={{
        display: "grid", gridTemplateColumns: klient.typ === "kupujuci" ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
        gap: "10px", marginBottom: "20px",
      }} className="cards-grid">
        {klient.typ === "kupujuci" && (
          <button onClick={() => router.push(`/kupujuci?klient_id=${klient.id}`)} style={{
            padding: "14px", background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "12px", cursor: "pointer", textAlign: "center",
            transition: "border-color 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#374151"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <div style={{ fontSize: "16px", marginBottom: "4px", opacity: 0.7 }}>📋</div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>Objednávka</div>
          </button>
        )}
        <button onClick={() => { if (klient.telefon) window.open(`tel:${klient.telefon}`); }} style={{
          padding: "14px", background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "12px", cursor: "pointer", textAlign: "center",
          transition: "border-color 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#374151"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
        >
          <div style={{ fontSize: "16px", marginBottom: "4px", opacity: 0.7 }}>📞</div>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>Zavolať</div>
        </button>
        <button onClick={() => {
          setPendingStatus(null);
          setShowDatePicker(true);
        }} style={{
          padding: "14px", background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "12px", cursor: "pointer", textAlign: "center",
          transition: "border-color 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#374151"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
        >
          <div style={{ fontSize: "16px", marginBottom: "4px", opacity: 0.7 }}>📅</div>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>Kalendár</div>
        </button>
      </div>

      {/* Štatistiky klienta — kliknuteľné, presmerujú na príslušný tab */}
      {(() => {
        const statsItems = [
          ...(!isCistyKupujuci ? [{ label: "Nábery", value: nabery.length, tab: "nehnutelnosti" as const }] : []),
          { label: "Objednávky", value: objednavky.length, tab: "objednavky" as const },
          ...(!isCistyKupujuci ? [{ label: "Inzeráty", value: inzeraty.length, tab: "nehnutelnosti" as const }] : []),
          { label: "Obhliadky", value: obhliadky.length, tab: "obhliadky" as const },
        ];
        return (
      <div style={{
        display: "grid", gridTemplateColumns: `repeat(${statsItems.length}, 1fr)`, gap: "10px", marginBottom: "20px",
      }} className="cards-grid">
        {statsItems.map(s => (
          <button key={s.label} onClick={() => {
            setActiveTab(s.tab);
            // Scroll k tabom
            setTimeout(() => {
              const el = document.querySelector('[data-tabs-anchor]');
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 50);
          }} style={{
            padding: "18px 16px", borderRadius: "12px",
            background: activeTab === s.tab ? "var(--bg-elevated)" : "var(--bg-surface)",
            border: activeTab === s.tab ? "1px solid #374151" : "1px solid var(--border)",
            textAlign: "center", cursor: "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#374151"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = activeTab === s.tab ? "#374151" : "var(--border)"; }}
          >
            <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
          </button>
        ))}
      </div>
        );
      })()}

      {/* Info-strip pre čistého kupujúceho — zhrnie "čo hľadá" z najnovšej
          objednávky (lokality, druh, cena_do, izby z poziadavky). Bez kliknutia
          na tab Objednávky vidí maklér hneď to najpodstatnejšie. */}
      {isCistyKupujuci && (() => {
        const last = (objednavky[0] as Record<string, unknown> | undefined) ?? null;
        if (!last) {
          return (
            <div style={{
              marginBottom: "16px", padding: "16px 18px", borderRadius: "12px",
              background: "var(--bg-elevated)", border: "1px dashed var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
            }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>🔎 Čo hľadá</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Klient zatiaľ nemá objednávku — vytvor ju aby si vedel čo presne hľadá.
                </div>
              </div>
              <button onClick={() => router.push(`/kupujuci?klient_id=${klient.id}`)} style={{
                padding: "8px 16px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>+ Pridať preferencie</button>
            </div>
          );
        }
        const lokalita = last.lokalita as Record<string, unknown> | string | null | undefined;
        const lokalitaText = typeof lokalita === "string"
          ? lokalita
          : lokalita && typeof lokalita === "object"
            ? Object.values(lokalita).filter(Boolean).join(", ")
            : "";
        const poz = (last.poziadavky as Record<string, unknown> | null | undefined) ?? null;
        const izby = poz?.izby ?? poz?.pocet_izieb;
        const druh = last.druh as string | undefined;
        const cenaDo = last.cena_do as number | undefined;
        return (
          <div style={{
            marginBottom: "16px", padding: "16px 18px", borderRadius: "12px",
            background: "#EFF6FF", border: "1px solid #BFDBFE",
          }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3A8A", marginBottom: "10px" }}>
              🔎 Čo hľadá
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              {lokalitaText && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>Lokalita</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1E3A8A", marginTop: "2px" }}>{lokalitaText}</div>
                </div>
              )}
              {druh && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>Typ</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1E3A8A", marginTop: "2px" }}>{druh}</div>
                </div>
              )}
              {cenaDo != null && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>Cena do</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1E3A8A", marginTop: "2px" }}>{Number(cenaDo).toLocaleString("sk")} €</div>
                </div>
              )}
              {izby != null && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>Izby</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1E3A8A", marginTop: "2px" }}>{String(izby)}</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Mobile insight panel — accordion pred tabmi */}
      {showInsightPanel && !wideLayout && (
        <div style={{ marginBottom: "16px" }}>
          <ClientInsightPanel
            klient={{ id: klient.id, typ: klient.typ ?? "predavajuci" }}
            nehnutelnostId={nehnutelnostIdForPanel}
            objednavkaId={objednavkaIdForPanel}
            predajnaCena={predajnaCenaForPanel}
            cenaDo={cenaDo}
            cenaOd={cenaOd}
            onPlanovatObhliadku={(matchKlientId, matchMeno, matchTel) => {
              setInsightKupujuciPrefill({ klientId: matchKlientId, meno: matchMeno, tel: matchTel });
              setShowObhliadkaModal(true);
            }}
          />
        </div>
      )}

      {/* Taby */}
      <div data-tabs-anchor style={{
        display: "flex", gap: "4px", marginBottom: "20px", padding: "4px",
        background: "var(--bg-elevated)", borderRadius: "12px",
        border: "1px solid var(--border)",
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)} style={{
            flex: 1, padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
            background: activeTab === t.key ? "var(--bg-surface)" : "transparent",
            border: activeTab === t.key ? "1px solid var(--border)" : "1px solid transparent",
            fontSize: "13px", fontWeight: activeTab === t.key ? "700" : "500",
            color: activeTab === t.key ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: activeTab === t.key ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
            transition: "all 0.15s",
          }}>
            {t.label} {t.count > 0 && <span style={{ fontSize: "11px", opacity: 0.6 }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Tab obsah */}
      {activeTab === "timeline" && (
        <div style={cardSt}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>
            📅 Časová os
          </div>

          {/* Quick-add bar */}
          <div style={{ marginBottom: "20px", background: "var(--bg-elevated)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: quickAddTyp ? "1px solid var(--border)" : "none" }}>
              {([
                { typ: "hovor", label: "📞 Hovor" },
                { typ: "poznamka", label: "📝 Poznámka" },
                { typ: "stretnutie", label: "📅 Stretnutie" },
                { typ: "email", label: "✉️ Email" },
              ] as const).map(b => (
                <button key={b.typ} onClick={() => setQuickAddTyp(quickAddTyp === b.typ ? null : b.typ)} style={{
                  flex: 1, padding: "10px 8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                  background: quickAddTyp === b.typ ? "var(--bg-surface)" : "transparent",
                  color: quickAddTyp === b.typ ? "var(--text-primary)" : "var(--text-muted)",
                  borderRight: "1px solid var(--border)", transition: "all 0.15s",
                }}>{b.label}</button>
              ))}
            </div>
            {quickAddTyp && (
              <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {quickAddTyp === "stretnutie" && (
                  <input
                    type="datetime-local"
                    value={quickAddDatum}
                    onChange={e => setQuickAddDatum(e.target.value)}
                    style={{
                      padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--border)",
                      background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px", outline: "none",
                    }}
                  />
                )}
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <textarea
                    value={quickAddText}
                    onChange={e => setQuickAddText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) quickSaveUdalost(); }}
                    placeholder={
                      quickAddTyp === "hovor" ? "Čo si dohodol..." :
                      quickAddTyp === "poznamka" ? "Poznámka..." :
                      quickAddTyp === "stretnutie" ? "Čo, kde..." :
                      "Čo si poslal..."
                    }
                    rows={2}
                    autoFocus
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)",
                      background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px",
                      resize: "none", fontFamily: "inherit", outline: "none",
                    }}
                  />
                  <button onClick={quickSaveUdalost} disabled={!quickAddText.trim() || quickAddSaving} style={{
                    padding: "8px 16px", background: "#374151", color: "#fff", border: "none",
                    borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                    opacity: !quickAddText.trim() || quickAddSaving ? 0.5 : 1, whiteSpace: "nowrap",
                  }}>
                    {quickAddSaving ? "..." : "Uložiť"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filter chips */}
          {timeline.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
              {[
                { key: "all", label: "Všetko" },
                { key: "udalost", label: "💬 Záznamy" },
                { key: "obhliadka", label: "🔑 Obhliadky" },
                { key: "naber", label: "📝 Nábery" },
                { key: "nehnutelnost", label: "🏡 Nehnuteľnosti" },
                { key: "objednavka", label: "📋 Objednávky" },
                { key: "dokument", label: "📄 Dokumenty" },
              ].map(f => (
                <button key={f.key} onClick={() => setTimelineFilter(f.key)} style={{
                  padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
                  cursor: "pointer", border: "1px solid var(--border)",
                  background: timelineFilter === f.key ? "var(--text-primary)" : "var(--bg-elevated)",
                  color: timelineFilter === f.key ? "var(--bg-surface)" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}>{f.label}</button>
              ))}
            </div>
          )}

          {timeline.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>
                Zatiaľ žiadna aktivita
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
                Začni pridaním náberového listu alebo objednávky.
              </div>
              <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)} style={{
                padding: "8px 20px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>+ Náberový list</button>
            </div>
          ) : (
            (() => {
              const filtered = timelineFilter === "all"
                ? timeline
                : timeline.filter(ev => ev.type === timelineFilter);

              if (filtered.length === 0) {
                return (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                    Žiadne záznamy pre tento filter.
                  </div>
                );
              }

              // Skupiny podľa mesiaca
              const groups: { label: string; events: typeof filtered }[] = [];
              let lastLabel = "";
              for (const ev of filtered) {
                const raw = new Date(ev.date).toLocaleDateString("sk", { month: "long", year: "numeric" });
                const label = raw.charAt(0).toUpperCase() + raw.slice(1);
                if (label !== lastLabel) {
                  groups.push({ label, events: [] });
                  lastLabel = label;
                }
                groups[groups.length - 1].events.push(ev);
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {groups.map(group => (
                    <div key={group.label}>
                      <div style={{
                        fontSize: "11px", fontWeight: "700", color: "var(--text-muted)",
                        textTransform: "uppercase", letterSpacing: "0.08em",
                        marginBottom: "12px", paddingBottom: "8px",
                        borderBottom: "1px solid var(--border)",
                      }}>
                        {group.label}
                      </div>
                      <div style={{ position: "relative" }}>
                        <div style={{
                          position: "absolute", left: "19px", top: "8px", bottom: "8px",
                          width: "2px", background: "var(--border)",
                        }} />
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          {group.events.map(ev => {
                            const isClickable = ev.type === "naber" || ev.type === "objednavka" || ev.type === "obhliadka" || ev.type === "nehnutelnost";
                            return (
                              <div key={ev.id}
                                onClick={() => {
                                  if (ev.type === "naber" || ev.type === "nehnutelnost") setActiveTab("nehnutelnosti");
                                  else if (ev.type === "objednavka") setActiveTab("objednavky");
                                  else if (ev.type === "obhliadka") setActiveTab("obhliadky");
                                }}
                                style={{
                                  display: "flex", gap: "16px", position: "relative",
                                  cursor: isClickable ? "pointer" : "default",
                                  padding: "8px", margin: "-8px", borderRadius: "10px",
                                  transition: "background 0.15s",
                                }}
                                onMouseEnter={e => { if (isClickable) e.currentTarget.style.background = "var(--bg-hover)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                              >
                                <div style={{
                                  width: "40px", height: "40px", borderRadius: "50%",
                                  background: `${ev.color}15`, border: `2px solid ${ev.color}`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "16px", flexShrink: 0, zIndex: 1,
                                }}>{ev.icon}</div>
                                <div style={{ flex: 1, paddingTop: "4px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                    {ev.title}
                                    {isClickable && <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: "500" }}>Zobraziť →</span>}
                                    {ev.deletable && (
                                      <button
                                        onClick={e => { e.stopPropagation(); if (confirm("Zmazať tento záznam?")) deleteUdalost(ev.id); }}
                                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "var(--text-muted)", padding: "0 4px", opacity: 0.5 }}
                                      >✕</button>
                                    )}
                                  </div>
                                  {ev.detail && (
                                    <div style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "4px", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                                      {ev.detail}
                                    </div>
                                  )}
                                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                                    {new Date(ev.date).toLocaleDateString("sk", {
                                      day: "numeric", month: "long", year: "numeric",
                                      hour: "2-digit", minute: "2-digit",
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      )}

      {activeTab === "nehnutelnosti" && (
        <div style={cardSt}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
              🏠 Nehnuteľnosti klienta
            </div>
            <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)} style={{
              padding: "6px 14px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>+ Pridať nehnuteľnosť</button>
          </div>
          {propertyCards.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              Žiadne nehnuteľnosti. Vyplň náberový list — objaví sa karta.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {propertyCards.map(card => {
                const cfg: Record<PropertyCard["status"], { bg: string; text: string; label: string }> = {
                  aktivny:      { bg: "#DCFCE7", text: "#16A34A", label: "Aktívny" },
                  koncept:      { bg: "#FEF3C7", text: "#D97706", label: "Koncept" },
                  predany:      { bg: "#E5E7EB", text: "#4B5563", label: "Predaný" },
                  archivovany:  { bg: "#F3F4F6", text: "#6B7280", label: "Archív" },
                  pripravujeme: { bg: "#F5F3FF", text: "#7C3AED", label: "Pripravujeme" },
                };
                const s = cfg[card.status];
                const nInzDocs = klientDokumenty.filter(d => (d as unknown as { nehnutelnost_id?: string }).nehnutelnost_id === (card.inzerat?.id as string | undefined)).length;
                const naberakId = (card.naberak as Record<string, unknown> | null)?.id as string | undefined;
                const inzId = card.inzerat?.id as string | undefined;
                const hasInzerat = !!inzId;
                return (
                  <div key={card.key} style={{
                    padding: "16px 18px", borderRadius: "12px",
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", lineHeight: 1.3 }}>
                          🏠 {card.titulok}
                        </div>
                        {card.podtitulok && (
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                            {card.podtitulok}
                          </div>
                        )}
                      </div>
                      <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: s.bg, color: s.text, whiteSpace: "nowrap" }}>
                        {s.label}
                      </span>
                    </div>
                    {/* Info row */}
                    <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px", flexWrap: "wrap" }}>
                      {card.cena != null && (
                        <span>💰 <strong style={{ color: "var(--text-primary)" }}>{Number(card.cena).toLocaleString("sk")} €</strong></span>
                      )}
                      <span>
                        {card.naberak
                          ? ((card.naberak as Record<string, unknown>).podpis_data ? "📝 Náberák ✓ podpísaný" : "📝 Náberák · čaká na podpis")
                          : "📝 Bez náberáku"}
                      </span>
                      <span>{hasInzerat ? "📰 Inzerát ✓" : "📰 Bez inzerátu"}</span>
                      {nInzDocs > 0 && <span>📎 {nInzDocs} dokumentov</span>}
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {naberakId && hasInzerat ? (
                        <button onClick={() => router.push(`/naber?klient_id=${klient.id}&parent=${naberakId}`)}
                          title="Originálny náberák sa nedá editovať — vytvoríš dodatok"
                          style={{ padding: "6px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-primary)", cursor: "pointer" }}>
                          📝 + Dodatok k náberáku
                        </button>
                      ) : naberakId ? (
                        <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)}
                          style={{ padding: "6px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-primary)", cursor: "pointer" }}>
                          📝 Upraviť náberák
                        </button>
                      ) : (
                        <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)}
                          style={{ padding: "6px 12px", background: "#374151", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                          📝 Vyplniť náberák
                        </button>
                      )}
                      {hasInzerat ? (
                        <button onClick={() => router.push(`/inzerat?id=${inzId}`)}
                          style={{ padding: "6px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-primary)", cursor: "pointer" }}>
                          📰 Otvoriť inzerát
                        </button>
                      ) : card.naberak && (
                        <button onClick={() => router.push(`/inzerat?klient_id=${klient.id}`)}
                          style={{ padding: "6px 12px", background: "#374151", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                          📰 Vytvoriť inzerát
                        </button>
                      )}
                      {/* Email-podpis pre nepodpísaný náberák */}
                      {naberakId && card.naberak && !(card.naberak as Record<string, unknown>).podpis_data && (
                        <SmsSignButton
                          entityType="naber"
                          entityId={naberakId}
                          defaultEmail={klient.email || ""}
                          userId={user?.id}
                          buttonStyle={{
                            padding: "6px 12px", background: "#1d4ed8", color: "#fff",
                            border: "none", borderRadius: "8px",
                            fontSize: "12px", fontWeight: 600, cursor: "pointer",
                          }}
                          buttonLabel="📧 Poslať klientovi link na podpis"
                          onSigned={() => loadAll()}
                        />
                      )}
                      {/* Archivovať — dostupné všetkým ak nie je už archivovaná */}
                      {inzId && card.status !== "archivovany" && (
                        <button onClick={async () => {
                          if (!confirm("Archivovať túto nehnuteľnosť?")) return;
                          await fetch(`/api/nehnutelnosti?id=${inzId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user_id: user?.id, status: "archivovany" }),
                          });
                          await loadAll();
                        }} style={{ padding: "6px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", cursor: "pointer" }}>
                          📦 Archivovať
                        </button>
                      )}
                      {/* Obnoviť z archívu */}
                      {inzId && card.status === "archivovany" && (
                        <button onClick={async () => {
                          await fetch(`/api/nehnutelnosti?id=${inzId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user_id: user?.id, status: "koncept" }),
                          });
                          await loadAll();
                        }} style={{ padding: "6px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", cursor: "pointer" }}>
                          ↩️ Obnoviť
                        </button>
                      )}
                      {/* Zmazať — len admin */}
                      {inzId && isAdmin && (
                        <button onClick={async () => {
                          if (!confirm("Natrvalo zmazať túto nehnuteľnosť? Táto akcia sa nedá vrátiť.")) return;
                          await fetch(`/api/nehnutelnosti?id=${inzId}`, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user_id: user?.id }),
                          });
                          await loadAll();
                        }} style={{ padding: "6px 12px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "#991B1B", cursor: "pointer" }}>
                          🗑 Zmazať
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(klient.typ === "predavajuci" || klient.typ === "oboje") && nabery.length > 0 && (() => {
            const nb = nabery[0] as Record<string, unknown>;
            const cena = nb.predajna_cena as number | null;
            return cena ? <ProviziaMiniCalc cena={cena} /> : null;
          })()}
        </div>
      )}

      {activeTab === "obhliadky" && (
        <div style={cardSt}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>Obhliadky</div>
            <button onClick={() => setShowObhliadkaModal(true)} style={{
              padding: "6px 14px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>+ Nová obhliadka</button>
          </div>
          {obhliadky.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              Žiadne obhliadky. Po naplánovaní sa tu zobrazí zoznam.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {obhliadky.map(o => {
                const status = String(o.status || "planovana");
                const statusCfg: Record<string, { bg: string; text: string; label: string }> = {
                  planovana: { bg: "#FEF3C7", text: "#92400E", label: "Plánovaná" },
                  prebehla: { bg: "#DBEAFE", text: "#1E40AF", label: "Prebehla" },
                  obhliadka_zaujem: { bg: "#DCFCE7", text: "#16A34A", label: "Záujem" },
                  obhliadka_bez_zaujmu: { bg: "#F3F4F6", text: "#6B7280", label: "Bez záujmu" },
                  zrusena: { bg: "#FEE2E2", text: "#991B1B", label: "Zrušená" },
                };
                const sc = statusCfg[status] || statusCfg.planovana;
                const dt = new Date(String(o.datum));
                const linkedNehn = inzeraty.find(i => (i as Record<string, unknown>).id === o.nehnutelnost_id) as Record<string, unknown> | undefined;
                const isPodpisana = !!o.podpis_data;
                return (
                  <div key={String(o.id)} style={{
                    padding: "14px 16px", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
                          {dt.toLocaleString("sk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                          🏠 {linkedNehn ? String(linkedNehn.nazov || "Nehnuteľnosť") : "—"}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                          👤 Kupujúci: <strong>{String(o.kupujuci_meno || "—")}</strong>
                          {o.kupujuci_telefon ? <> · 📱 {String(o.kupujuci_telefon)}</> : null}
                          {o.kupujuci_email ? <> · ✉️ {String(o.kupujuci_email)}</> : null}
                        </div>
                        {!!o.miesto && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>📍 {String(o.miesto)}</div>}
                      </div>
                      <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: sc.bg, color: sc.text }}>
                        {isPodpisana ? "✓ " : ""}{sc.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                      {!isPodpisana && (
                        <button onClick={() => router.push(`/obhliadky/${o.id}`)}
                          style={{ padding: "5px 10px", background: "#374151", color: "#fff", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                          ✍️ Podpísať
                        </button>
                      )}
                      {(["prebehla","obhliadka_zaujem","obhliadka_bez_zaujmu","zrusena"] as const).filter(s => s !== status).map(s => (
                        <button key={s} onClick={async () => {
                          await fetch("/api/obhliadky", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id, status: s }) });
                          // Log do timeline
                          const stavLabel: Record<string, string> = { prebehla: "prebehla", obhliadka_zaujem: "so záujmom", obhliadka_bez_zaujmu: "bez záujmu", zrusena: "zrušená" };
                          const datumLbl = new Date(o.datum as string).toLocaleDateString("sk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
                          try { await fetch("/api/klient-udalosti", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ klient_id: id, typ: "ine", popis: `Obhliadka ${stavLabel[s] || s} — ${String(o.kupujuci_meno || "—")} · ${datumLbl}` }) }); } catch {}
                          const r = await fetch(`/api/obhliadky?klient_id=${id}`); const d = await r.json(); setObhliadky(d.obhliadky || []); await loadAll();
                        }}
                          style={{ padding: "5px 10px", background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px", fontWeight: "500", cursor: "pointer" }}>
                          → {statusCfg[s]?.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "objednavky" && (
        <div style={cardSt}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
              📋 Objednávky
            </div>
            <button onClick={() => {
              const firstNehn = inzeraty[0] as Record<string, unknown> | undefined;
              if ((klient.typ === "predavajuci" || klient.typ === "oboje") && firstNehn?.id) {
                router.push(`/nastroje?tab=matching&nehnutelnost=${firstNehn.id}`);
              } else {
                router.push("/kupujuci");
              }
            }} style={{
              padding: "6px 14px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>+ Nová objednávka</button>
          </div>
          {objednavky.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              Žiadne objednávky
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {objednavky.map((o: Record<string, unknown>) => {
                const isPodpisana = !!o.podpis;
                return (
                  <div key={o.id as string} onClick={() => setDetailObj(o)} style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 16px", borderRadius: "10px", background: "var(--bg-elevated)",
                    border: "1px solid var(--border)", cursor: "pointer",
                  }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: "#ECFDF5", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "18px", flexShrink: 0,
                    }}>📋</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
                        {String(o.druh || "—")}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {o.cena_do ? `Max: ${Number(o.cena_do).toLocaleString("sk")} €` : "—"} · {isPodpisana ? "✓ podpísaná" : "čaká na podpis"}
                      </div>
                    </div>
                    {!isPodpisana && (
                      <SmsSignButton
                        entityType="objednavka"
                        entityId={String(o.id)}
                        defaultEmail={klient.email || ""}
                        userId={user?.id}
                        buttonStyle={{
                          padding: "6px 12px", background: "#1d4ed8", color: "#fff",
                          border: "none", borderRadius: "8px",
                          fontSize: "11px", fontWeight: 600, cursor: "pointer",
                        }}
                        buttonLabel="📧 Podpis cez email"
                        onSigned={() => loadAll()}
                      />
                    )}
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(o.created_at as string).toLocaleDateString("sk")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Kalkulačka + matching pre kupujúceho */}
          {(klient.typ === "kupujuci" || klient.typ === "oboje") && objednavky.length > 0 && (() => {
            const firstObj = objednavky[0] as Record<string, unknown>;
            const cenaDo = firstObj.cena_do as number | null;
            const objId = firstObj.id as string;
            return (
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {cenaDo && <HypotekaMiniCalc cena={cenaDo} />}
                <NajlepsieZhodyPanel
                  objednavkaId={objId}
                  onPlanovatObhliadku={() => setShowObhliadkaModal(true)}
                />
              </div>
            );
          })()}
        </div>
      )}

      {detailObj && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setDetailObj(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: "520px", background: "var(--bg-surface)", borderRadius: "16px 16px 0 0",
            padding: "24px 24px 32px", maxHeight: "80vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                  📋 {String(detailObj.druh || "Objednávka")}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {detailObj.created_at ? new Date(detailObj.created_at as string).toLocaleDateString("sk", { day: "numeric", month: "long", year: "numeric" }) : ""}
                </div>
              </div>
              <button onClick={() => setDetailObj(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>×</button>
            </div>
            {(() => {
              const lok = (detailObj.lokalita || {}) as Record<string, unknown>;
              const poziad = (detailObj.poziadavky || {}) as Record<string, unknown>;
              const rows: [string, string][] = [];
              const druhRaw = detailObj.druh as string | string[] | null;
              const druhArr = Array.isArray(druhRaw) ? druhRaw : String(druhRaw || "").split(/[,/]/).map((s: string) => s.trim()).filter(Boolean);
              if (druhArr.length) rows.push(["Typ", druhArr.join(", ")]);
              const lokArr: string[] = [];
              if ((lok.kraje as string[] | undefined)?.length) lokArr.push((lok.kraje as string[]).join(", "));
              if ((lok.okresy as string[] | undefined)?.length) lokArr.push((lok.okresy as string[]).join(", "));
              if (lok.obec) lokArr.push(String(lok.obec));
              if (lokArr.length) rows.push(["Lokalita", lokArr.join(" / ")]);
              if (poziad.pocet_izieb) rows.push(["Izby", String(poziad.pocet_izieb)]);
              if (detailObj.cena_od || detailObj.cena_do) {
                const c = detailObj.cena_od && detailObj.cena_do
                  ? `${Number(detailObj.cena_od).toLocaleString("sk")} – ${Number(detailObj.cena_do).toLocaleString("sk")} €`
                  : detailObj.cena_do ? `max. ${Number(detailObj.cena_do).toLocaleString("sk")} €` : `od ${Number(detailObj.cena_od).toLocaleString("sk")} €`;
                rows.push(["Cena", c]);
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  {rows.map(([label, val]) => (
                    <div key={label} style={{ display: "flex", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", width: "80px", flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", width: "80px", flexShrink: 0 }}>Podpis</span>
                    <span style={{ fontSize: "13px", color: detailObj.podpis ? "#16a34a" : "#b45309", fontWeight: 500 }}>
                      {detailObj.podpis ? "✓ Podpísaná" : "Čaká na podpis"}
                    </span>
                  </div>
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <a href={`/api/objednavka-pdf?id=${String(detailObj.id)}`} target="_blank" rel="noopener noreferrer"
                style={{ padding: "9px 18px", background: "#374151", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
                ⬇ Stiahnuť PDF
              </a>
              {!detailObj.podpis && (
                <button onClick={(e) => { e.stopPropagation(); setDetailObj(null); }}
                  style={{ padding: "9px 18px", background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Zatvoriť
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "dokumenty" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* LV sekcia */}
          <LVSection
            klientId={klient.id}
            userId={user?.id || ""}
            lvData={klient.lv_data}
            canEdit={!!isOwner}
            klientMeno={klient.meno || ""}
            klientLokalita={klient.lokalita || ""}
            onFixName={async (newName) => {
              if (user?.id) await klientUpdate(user.id, klient.id, { meno: newName });
              setKlient(k => k ? { ...k, meno: newName } : k);
              // Sync kalendár event
              const calEventId = (klient as { calendar_event_id?: string | null }).calendar_event_id;
              if (calEventId && user?.id) {
                const isNaber = klient.status === "dohodnuty_naber" || klient.status === "nabrany";
                const prefix = isNaber ? "Náber" : "Zavolať";
                fetch("/api/google/calendar", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user.id, eventId: calEventId,
                    summary: `${prefix} — ${newName}`,
                  }),
                }).catch(() => {});
              }
            }}
            onFixLocation={async (newLok) => {
              if (user?.id) await klientUpdate(user.id, klient.id, { lokalita: newLok });
              setKlient(k => k ? { ...k, lokalita: newLok } : k);
            }}
            onParsed={(data) => {
            // Porovnaj LV s existujúcimi údajmi klienta
            const checks: { field: string; label: string; old: string; new_: string }[] = [];
            const lv = data as Record<string, unknown>;
            const addrMatch = klient.poznamka?.match(/Adresa:\s*(.+?)(?:\n|$)/);
            const existingAddr = addrMatch?.[1]?.trim() || "";
            const lvAddr = [lv.ulica, lv.supisne_cislo, lv.obec].filter(Boolean).map(String).join(" ").trim();
            if (existingAddr && lvAddr && existingAddr.toLowerCase() !== lvAddr.toLowerCase()) {
              checks.push({ field: "adresa", label: "Adresa", old: existingAddr, new_: lvAddr });
            }
            if (klient.lokalita && lv.obec && String(lv.obec).toLowerCase() !== klient.lokalita.toLowerCase()
                && !klient.lokalita.toLowerCase().includes(String(lv.obec).toLowerCase())) {
              checks.push({ field: "lokalita", label: "Lokalita / Obec", old: klient.lokalita, new_: String(lv.obec) });
            }
            // Typ nehnuteľnosti check
            const noteTyp = klient.poznamka?.match(/Typ nehnuteľnosti:\s*(.+)/i)?.[1]?.trim() || "";
            const lvTyp = lv.typ ? String(lv.typ) : "";
            if (noteTyp && lvTyp && noteTyp.toLowerCase() !== lvTyp.toLowerCase()) {
              checks.push({ field: "typ", label: "Typ nehnuteľnosti", old: noteTyp, new_: lvTyp });
            }

            if (checks.length > 0) {
              setLvDiff(checks);
              setShowLVDiff(true);
            }
            setKlient(k => k ? { ...k, lv_data: data } : k);
            // Unified edit modal aj z Dokumenty tab flowu
            openLvEditModalAlways(data);

            // Aktualizuj Google Calendar event s adresou z LV
            const calEventId = (klient as { calendar_event_id?: string | null }).calendar_event_id;
            if (calEventId && user?.id && lvAddr) {
              fetch("/api/google/calendar", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user.id,
                  eventId: calEventId,
                  location: lvAddr,
                  description: [
                    `Adresa: ${lvAddr}`,
                    klient.telefon && `Tel: ${klient.telefon}`,
                    klient.email && `Email: ${klient.email}`,
                  ].filter(Boolean).join("\n"),
                }),
              }).catch(() => { /* calendar update silent */ });
            }

            // Ponúkni premenovanie ak meno klienta nezodpovedá žiadnemu vlastníkovi z LV
            const majitelia = lv.majitelia as Array<{ meno?: string }> | undefined;
            if (majitelia?.length) {
              // Rozdeľ spojené mená (napr. "Ján Novák a Anna Nováková")
              const rawNames = majitelia.filter(m => m.meno).map(m => m.meno!);
              const ownerNames: string[] = [];
              for (const name of rawNames) {
                // Rozdeľ na " a " ale nie na "a" vnútri mena
                const parts = name.split(/\s+a\s+/i).map(n => n.trim()).filter(n => n.length > 2);
                if (parts.length > 1) {
                  ownerNames.push(...parts);
                } else {
                  ownerNames.push(name);
                }
              }
              const currentName = klient.meno.trim().toLowerCase();
              const nameMatchesAnyOwner = ownerNames.some(n =>
                n.toLowerCase() === currentName ||
                currentName.includes(n.toLowerCase()) ||
                n.toLowerCase().includes(currentName)
              );
              if (!nameMatchesAnyOwner && ownerNames.length > 0) {
                setLvOwnerNames(ownerNames);
                setSelectedLvOwner(ownerNames[0]);
                setShowLVRename(true);
              }
            }
          }} />
          {/* Ostatné dokumenty — fotky idú do vlastnej kategórie (Supabase Storage), nie sem */}
          {(() => {
            const dokumentyBezFotiekVsetky = klientDokumenty.filter(d => d.type !== "Foto");
            const dokumentyBezFotiek = docTypeFilter
              ? dokumentyBezFotiekVsetky.filter(d => (d.type || "Dokument") === docTypeFilter)
              : dokumentyBezFotiekVsetky;
            const allTypes = Array.from(new Set(dokumentyBezFotiekVsetky.map(d => d.type || "Dokument"))).sort();
            // Zgrupuj dokumenty do priečinkov:
            //   - jedna zložka per nehnuteľnosť (podľa nehnutelnost_id)
            //   - zvyšok v zložke "Všeobecné (klient)"
            type Folder = { key: string; label: string; icon: string; docs: typeof dokumentyBezFotiek };
            const folders: Folder[] = [];
            for (const card of propertyCards) {
              const inzId = card.inzerat?.id as string | undefined;
              if (!inzId) continue;
              const docs = dokumentyBezFotiek.filter(d => (d as unknown as { nehnutelnost_id?: string }).nehnutelnost_id === inzId);
              folders.push({ key: `inz-${inzId}`, label: card.titulok, icon: "🏠", docs });
            }
            const generalDocs = dokumentyBezFotiek.filter(d => !(d as unknown as { nehnutelnost_id?: string }).nehnutelnost_id);
            folders.push({ key: "general", label: "Všeobecné (klient)", icon: "📂", docs: generalDocs });

            return (
          <div style={cardSt}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
                📁 Dokumenty ({dokumentyBezFotiek.length}{docTypeFilter ? ` z ${dokumentyBezFotiekVsetky.length}` : ""})
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {allTypes.length > 1 && (
                  <select value={docTypeFilter} onChange={e => setDocTypeFilter(e.target.value)} style={{
                    padding: "6px 10px", fontSize: "12px", borderRadius: "6px",
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    color: "var(--text-primary)", cursor: "pointer",
                  }}>
                    <option value="">Všetky typy</option>
                    {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                <button onClick={() => {
                  if (collapsedFolders.size === 0) {
                    setCollapsedFolders(new Set(folders.map(f => f.key)));
                  } else {
                    setCollapsedFolders(new Set());
                  }
                }} style={{
                  padding: "6px 10px", fontSize: "12px", background: "var(--bg-elevated)",
                  border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-secondary)",
                  cursor: "pointer",
                }}>
                  {collapsedFolders.size === 0 ? "− Zbaliť všetko" : "+ Rozbaliť všetko"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {folders.map(folder => {
                  const isCollapsed = collapsedFolders.has(folder.key);
                  return (
                  <div key={folder.key} style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                    <div
                      onClick={() => {
                        setCollapsedFolders(prev => {
                          const next = new Set(prev);
                          if (next.has(folder.key)) next.delete(folder.key);
                          else next.add(folder.key);
                          return next;
                        });
                      }}
                      style={{
                        padding: "10px 14px", background: "var(--bg-elevated)",
                        borderBottom: isCollapsed ? "none" : "1px solid var(--border)",
                        display: "flex", alignItems: "center", gap: "8px",
                        fontSize: "13px", fontWeight: "700", color: "var(--text-primary)",
                        cursor: "pointer", userSelect: "none",
                      }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", transition: "transform 0.15s", transform: isCollapsed ? "rotate(-90deg)" : "none" }}>▼</span>
                      <span>{folder.icon}</span>
                      <span style={{ flex: 1 }}>{folder.label}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>
                        {folder.docs.length} {folder.docs.length === 1 ? "súbor" : folder.docs.length < 5 ? "súbory" : "súborov"}
                      </span>
                      <label onClick={e => e.stopPropagation()} style={{
                        padding: "4px 10px", background: "#374151", color: "#fff",
                        border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "600",
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px",
                      }}>
                        + Pridať
                        <input type="file" multiple accept=".pdf,image/*,.doc,.docx"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            e.currentTarget.value = "";
                            for (const f of files) {
                              const reader = new FileReader();
                              const base64: string = await new Promise((res, rej) => {
                                reader.onload = () => res((reader.result as string).split(",")[1] || "");
                                reader.onerror = rej;
                                reader.readAsDataURL(f);
                              });
                              const nehnId = folder.key.startsWith("inz-") ? folder.key.slice(4) : null;
                              await saveKlientDokument({
                                klient_id: klient.id,
                                nehnutelnost_id: nehnId,
                                name: f.name,
                                type: f.type.startsWith("image/") ? "Fotka" : "Dokument",
                                size: f.size,
                                source: "upload",
                                mime: f.type || "application/octet-stream",
                                data_base64: base64,
                              });
                            }
                            const refreshed = await listKlientDokumenty(klient.id);
                            setKlientDokumenty(refreshed);
                          }}
                        />
                      </label>
                    </div>
                    {!isCollapsed && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px" }}>
                      {folder.docs.map(d => (
                        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                          <span style={{ fontSize: "16px" }}>📄</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {d.type || "Dokument"} · {((d.size || 0) / 1024).toFixed(0)} KB · {d.source || "—"} · {d.created_at ? new Date(d.created_at).toLocaleDateString("sk-SK") : ""}
                            </div>
                          </div>
                          {d.data_base64 && (
                            <>
                              <button
                                onClick={() => {
                                  try {
                                    const bin = atob(d.data_base64 as string);
                                    const bytes = new Uint8Array(bin.length);
                                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                                    const blob = new Blob([bytes], { type: d.mime || "application/pdf" });
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, "_blank");
                                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                                  } catch (e) { console.error(e); }
                                }}
                                style={{ fontSize: "11px", color: "var(--accent, #3B82F6)", background: "none", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>
                                Otvoriť
                              </button>
                              <a href={`data:${d.mime || "application/octet-stream"};base64,${d.data_base64}`} download={d.name}
                                 style={{ fontSize: "11px", color: "var(--text-secondary)", textDecoration: "none", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "6px" }}>
                                ⬇
                              </a>
                            </>
                          )}
                          {/* "..." menu — presunúť do iného priečinka */}
                          <div style={{ position: "relative" }}>
                            <button onClick={() => setMoveMenuFor(moveMenuFor === d.id ? null : (d.id || null))}
                              style={{ fontSize: "12px", color: "var(--text-secondary)", background: "none", padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer", fontWeight: "700" }}>
                              ⋯
                            </button>
                            {moveMenuFor === d.id && (
                              <div style={{
                                position: "absolute", top: "30px", right: 0, zIndex: 50,
                                background: "var(--bg-surface)", border: "1px solid var(--border)",
                                borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                minWidth: "220px", overflow: "hidden",
                              }}>
                                <div style={{ padding: "8px 12px", fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
                                  Presunúť do…
                                </div>
                                {folders.filter(f => f.key !== folder.key).map(target => (
                                  <button key={target.key}
                                    onClick={async () => {
                                      const newId = target.key.startsWith("inz-") ? target.key.slice(4) : null;
                                      await fetch("/api/klient-dokumenty", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ id: d.id, nehnutelnost_id: newId }),
                                      });
                                      setMoveMenuFor(null);
                                      const refreshed = await listKlientDokumenty(klient.id);
                                      setKlientDokumenty(refreshed);
                                    }}
                                    style={{
                                      display: "block", width: "100%", padding: "8px 12px", textAlign: "left",
                                      background: "transparent", border: "none", cursor: "pointer",
                                      fontSize: "12px", color: "var(--text-primary)",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                    {target.icon} {target.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {isAdmin && (
                            <button onClick={async () => { if (d.id && confirm("Vymazať dokument?")) { await deleteKlientDokument(d.id); setKlientDokumenty(prev => prev.filter(x => x.id !== d.id)); } }}
                                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }}>×</button>
                          )}
                        </div>
                      ))}
                      {folder.docs.length === 0 && (
                        <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                          Prázdny priečinok — pridaj dokument tlačidlom &quot;+ Pridať&quot; vyššie.
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
          </div>
            );
          })()}
        </div>
      )}

      {/* CRM Log — audit log z klienti_history (makler transfery, SLA eventy) */}
      {activeTab === "historia" && (
        <div style={cardSt}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
            CRM Log
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
            Systémové eventy: prevody medzi maklérmi, SLA upozornenia, pool management.
          </div>
          <KlientHistoryTab klientId={klient.id} />
        </div>
      )}

      {/* Poznámky */}
      {klient.poznamka && (
        <div style={{ ...cardSt, marginTop: "20px" }}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
            💬 Poznámky
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
            {klient.poznamka}
          </div>
        </div>
      )}

      {/* Modal: Nová obhliadka */}
      {showObhliadkaModal && (
        <ObhliadkaModal
          klient={klient}
          inzeraty={inzeraty}
          myMaklerUuid={myMaklerUuid}
          prefill={obhliadkaPrefill}
          initialKupujuci={insightKupujuciPrefill}
          onBack={obhliadkaCameFromPicker ? () => {
            // Späť do datetime pickeru "Nová udalosť"
            setShowObhliadkaModal(false);
            setObhliadkaPrefill(null);
            setObhliadkaCameFromPicker(false);
            setInsightKupujuciPrefill(null);
            setShowDatePicker(true);
          } : undefined}
          onClose={() => {
            setShowObhliadkaModal(false);
            setObhliadkaPrefill(null);
            setObhliadkaCameFromPicker(false);
            setInsightKupujuciPrefill(null);
          }}
          onCreated={async () => {
            setShowObhliadkaModal(false);
            setObhliadkaPrefill(null);
            setObhliadkaCameFromPicker(false);
            setInsightKupujuciPrefill(null);
            const r = await fetch(`/api/obhliadky?klient_id=${id}`);
            const d = await r.json();
            setObhliadky(d.obhliadky || []);
          }}
        />
      )}

      {/* Datetime picker modal */}
      {showDatePicker && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }} onClick={() => { setShowDatePicker(false); setPendingStatus(null); setNaberDatum(""); setNaberMiesto(""); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "20px", padding: "32px",
            maxWidth: "400px", width: "100%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
              {pendingStatus === "dohodnuty_naber" ? "Kedy a kde bude náber?" : pendingStatus === "volat_neskor" ? "Kedy zavolať?" : "Nová udalosť"}
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
              {pendingStatus === "dohodnuty_naber"
                ? <>Termín stretnutia s <strong style={{ color: "var(--text-primary)" }}>{klient.meno}</strong> (1 hodina)</>
                : pendingStatus === "volat_neskor"
                ? <>Pripomienka na zavolanie <strong style={{ color: "var(--text-primary)" }}>{klient.meno}</strong> (15 min)</>
                : <>Pre <strong style={{ color: "var(--text-primary)" }}>{klient.meno}</strong></>
              }
            </p>
            {/* Event type selector — only when generic (no pendingStatus) */}
            {!pendingStatus && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px", maxWidth: "320px", marginLeft: "auto", marginRight: "auto" }}>
                {[
                  { v: "volat", l: "Zavolať" },
                  { v: "naber", l: "Náber" },
                  { v: "obhliadka", l: "Obhliadka" },
                  { v: "podpis", l: "Podpis zmluvy" },
                  { v: "fotenie", l: "Fotenie" },
                  { v: "odovzdanie", l: "Odovzdanie kľúčov" },
                  { v: "ine", l: "Iné" },
                ].map(o => (
                  <button key={o.v} onClick={() => {
                    // Špeciál: pri "Obhliadka" rovno otvor plný formulár obhliadky
                    if (o.v === "obhliadka") {
                      setShowDatePicker(false);
                      setObhliadkaPrefill(null); // Bez prefill — používateľ vyplní v plnom modaly
                      setObhliadkaCameFromPicker(true); // Pre "Späť" tlačidlo
                      setShowObhliadkaModal(true);
                      return;
                    }
                    setEventType(o.v as typeof eventType);
                  }} style={{
                    padding: "10px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "600",
                    cursor: "pointer", textAlign: "center",
                    background: eventType === o.v ? "#374151" : "var(--bg-elevated)",
                    color: eventType === o.v ? "#fff" : "var(--text-secondary)",
                    border: eventType === o.v ? "1px solid #374151" : "1px solid var(--border)",
                  }}>{o.l}</button>
                ))}
              </div>
            )}
            {!pendingStatus && eventType === "ine" && (
              <input
                type="text"
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                placeholder="Názov udalosti"
                style={{
                  width: "100%", maxWidth: "300px", padding: "12px 16px", marginBottom: "12px",
                  background: "var(--bg-elevated)", border: "2px solid var(--border)",
                  borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)",
                  outline: "none", textAlign: "center",
                }}
              />
            )}
            {/* Location — pre náber, obhliadku, podpis, fotenie, odovzdanie */}
            {(pendingStatus === "dohodnuty_naber" || (!pendingStatus && ["naber","obhliadka","podpis","fotenie","odovzdanie"].includes(eventType))) && (
              <div style={{ position: "relative", maxWidth: "300px", margin: "0 auto 12px" }}>
                <input
                  type="text"
                  value={naberMiesto}
                  onChange={e => setNaberMiesto(e.target.value)}
                  placeholder="Adresa / miesto stretnutia"
                  style={{
                    width: "100%", padding: "12px 44px 12px 16px",
                    background: "var(--bg-elevated)", border: "2px solid var(--border)",
                    borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)",
                    outline: "none", textAlign: "center",
                  }}
                />
                <button
                  type="button"
                  title="Vyplniť adresu klienta"
                  onClick={() => {
                    const adrMatch = klient.poznamka?.match(/Adresa:\s*(.+)/);
                    const addr = adrMatch ? adrMatch[1].trim() : (klient.lokalita || "");
                    setNaberMiesto(addr);
                  }}
                  style={{
                    position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    cursor: "pointer", fontSize: "14px", display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >📍</button>
              </div>
            )}
            {/* Ulica + číslo — povinné pri dohodnutom nábere */}
            {pendingStatus === "dohodnuty_naber" && (
              <div style={{ display: "flex", gap: "8px", maxWidth: "300px", margin: "0 auto 12px" }}>
                <input
                  type="text"
                  value={naberUlica}
                  onChange={e => { setNaberUlica(e.target.value); setNaberAddrError(""); }}
                  placeholder="Ulica *"
                  style={{
                    flex: 1, padding: "12px 16px",
                    background: "var(--bg-elevated)", border: naberAddrError && !naberUlica.trim() ? "2px solid #EF4444" : "2px solid var(--border)",
                    borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
                <input
                  type="text"
                  value={naberCislo}
                  onChange={e => { setNaberCislo(e.target.value); setNaberAddrError(""); }}
                  placeholder="Č. *"
                  style={{
                    width: "70px", padding: "12px 10px",
                    background: "var(--bg-elevated)", border: naberAddrError && !naberCislo.trim() ? "2px solid #EF4444" : "2px solid var(--border)",
                    borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)",
                    outline: "none", textAlign: "center",
                  }}
                />
              </div>
            )}
            {naberAddrError && <div style={{ fontSize: "11px", color: "#EF4444", marginBottom: "8px" }}>{naberAddrError}</div>}
            <input
              type="datetime-local"
              value={naberDatum ? naberDatum.slice(0, 16) : ""}
              onChange={e => setNaberDatum(e.target.value || "")}
              style={{
                width: "100%", maxWidth: "300px", padding: "14px 16px",
                background: "var(--bg-elevated)", border: "2px solid var(--border)",
                borderRadius: "12px", fontSize: "15px", color: "var(--text-primary)",
                outline: "none", textAlign: "center",
              }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "24px" }}>
              <button onClick={() => { setShowDatePicker(false); setPendingStatus(null); setNaberDatum(""); setNaberMiesto(""); }} style={{
                padding: "10px 24px", background: "var(--bg-elevated)",
                color: "var(--text-secondary)", border: "1px solid var(--border)",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>Zrušiť</button>
              <button disabled={calendarSyncing || !naberDatum} onClick={() => handleDateConfirm()} style={{
                padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                opacity: calendarSyncing || !naberDatum ? 0.5 : 1,
              }}>
                {calendarSyncing ? "Ukladám..." : pendingStatus === "dohodnuty_naber" ? "Potvrdiť náber" : pendingStatus === "volat_neskor" ? "Uložiť pripomienku" : "Pridať do kalendára"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spolupráca modal */}
      {showSpolupracaModal && klient && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setShowSpolupracaModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "20px", padding: "32px", maxWidth: "400px", width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", margin: "0 auto 16px", border: "2px solid #BFDBFE" }}>🤝</div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>Pridať spoluprácu</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
              Vyberte maklera a nastavte jeho podiel z provízie
            </p>
            <select value={spolupracaMakler} onChange={e => setSpolupracaMakler(e.target.value)} style={{
              width: "100%", maxWidth: "300px", padding: "12px 16px", marginBottom: "16px",
              background: "var(--bg-elevated)", border: "2px solid var(--border)",
              borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)", outline: "none",
              appearance: "none" as const,
            }}>
              <option value="">Vybrať maklera...</option>
              {makleri.filter(m => m.id !== klient.makler_id).map(m => (
                <option key={m.id} value={m.id}>{m.meno}</option>
              ))}
            </select>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                Podiel z provízie: {spolupracaPct}%
              </label>
              <input type="range" min={5} max={50} step={5} value={spolupracaPct}
                onChange={e => setSpolupracaPct(Number(e.target.value))}
                style={{ width: "100%", maxWidth: "300px" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "300px", margin: "4px auto 0", fontSize: "11px", color: "var(--text-muted)" }}>
                <span>5%</span>
                <span>50%</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setShowSpolupracaModal(false)} style={{
                padding: "10px 24px", background: "var(--bg-elevated)", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>Zrušiť</button>
              <button disabled={!spolupracaMakler} onClick={async () => {
                if (user?.id) await klientUpdate(user.id, klient.id, {
                  spolupracujuci_makler_id: spolupracaMakler,
                  spolupracujuci_provizia_pct: spolupracaPct,
                });
                setShowSpolupracaModal(false);
                setSpolupracaMakler("");
                setSpolupracaPct(50);
                loadAll();
              }} style={{
                padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                opacity: spolupracaMakler ? 1 : 0.5,
              }}>Pridať spoluprácu</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <NewKlientModal
          open
          showTypKlienta
          editKlient={{
            id: klient.id,
            meno: klient.meno,
            telefon: klient.telefon,
            email: klient.email,
            status: klient.status,
            typ: klient.typ,
            lokalita: klient.lokalita,
            poznamka: klient.poznamka,
            calendar_event_id: (klient as { calendar_event_id?: string | null }).calendar_event_id ?? null,
            datum_naberu: (klient as { datum_naberu?: string | null }).datum_naberu ?? null,
            datum_narodenia: (klient as { datum_narodenia?: string | null }).datum_narodenia ?? null,
            lv_data: klient.lv_data as Record<string, unknown> | null,
          }}
          onClose={() => setEditModal(false)}
          onSaved={() => { setEditModal(false); loadAll(); }}
          onLvPrompt={() => setShowLVPrompt(true)}
        />
      )}

      </div>{/* END left col */}

      {showInsightPanel && wideLayout && (
        <div style={{ width: "300px", flexShrink: 0 }}>
          <ClientInsightPanel
            klient={{ id: klient.id, typ: klient.typ ?? "predavajuci" }}
            nehnutelnostId={nehnutelnostIdForPanel}
            objednavkaId={objednavkaIdForPanel}
            predajnaCena={predajnaCenaForPanel}
            cenaDo={cenaDo}
            cenaOd={cenaOd}
            onPlanovatObhliadku={(matchKlientId, matchMeno, matchTel) => {
              setInsightKupujuciPrefill({ klientId: matchKlientId, meno: matchMeno, tel: matchTel });
              setShowObhliadkaModal(true);
            }}
          />
        </div>
      )}

      </div>{/* END flex row */}
    </div>
  );
}

/* ── Modal: Nová obhliadka ─────────────────────────────────────────── */
function ObhliadkaModal({
  klient, inzeraty, myMaklerUuid, prefill, initialKupujuci, onClose, onCreated, onBack,
}: {
  klient: { id: string; meno: string; typ?: string };
  inzeraty: Record<string, unknown>[];
  myMaklerUuid: string | null;
  prefill?: { datum: string; miesto: string } | null;
  initialKupujuci?: { klientId: string; meno: string; tel?: string | null } | null;
  onClose: () => void;
  onCreated: () => void;
  onBack?: () => void;
}) {
  const { user: authUser } = useAuth();
  const isCurrentBuyer = klient.typ === "kupujuci";
  const [createCalendar, setCreateCalendar] = useState(!prefill); // Ak prefill (z datetime picker), kalendár už existuje
  const [nehnId, setNehnId] = useState<string>(() => String((inzeraty[0] as Record<string, unknown> | undefined)?.id || ""));
  const [datum, setDatum] = useState<string>(() => {
    if (prefill?.datum) return prefill.datum;
    const now = new Date();
    const d = new Date(now);
    // Ak pred 14:00 → dnes 17:00, inak → zajtra 17:00 (preskočí víkend)
    if (now.getHours() < 14) {
      d.setHours(17, 0, 0, 0);
    } else {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 6) d.setDate(d.getDate() + 2); // sobota → pondelok
      if (d.getDay() === 0) d.setDate(d.getDate() + 1); // nedeľa → pondelok
      d.setHours(17, 0, 0, 0);
    }
    return d.toISOString().slice(0, 16);
  });
  // Adresa: predvyplnené z prefill, alebo z aktuálnej nehnuteľnosti, alebo prázdne (manual)
  const adresyZNehnutelnosti = inzeraty.map(i => {
    const r = i as Record<string, unknown>;
    return {
      id: String(r.id),
      adresa: [r.ulica_privatna, r.lokalita].filter(Boolean).join(", ") || String(r.nazov || ""),
    };
  });
  const [miestoMode, setMiestoMode] = useState<"adresa" | "manual">(prefill?.miesto ? "manual" : "adresa");
  const [miesto, setMiesto] = useState(prefill?.miesto || "");
  const [kupMeno, setKupMeno] = useState(initialKupujuci?.meno ?? "");
  const [kupTel, setKupTel] = useState(initialKupujuci?.tel ?? "");
  const [kupEmail, setKupEmail] = useState("");
  const [kupKlientId, setKupKlientId] = useState<string | null>(initialKupujuci?.klientId ?? null);
  const [kupQuery, setKupQuery] = useState(initialKupujuci?.meno ?? "");
  const [kupOptions, setKupOptions] = useState<{ id: string; meno: string; telefon?: string | null; email?: string | null }[]>([]);
  const [showKupDropdown, setShowKupDropdown] = useState(false);
  const [poznamka, setPoznamka] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (kupQuery.length < 2) { setKupOptions([]); return; }
    let cancelled = false;
    supabase.from("klienti").select("id, meno, telefon, email")
      .ilike("meno", `%${kupQuery}%`).limit(8)
      .then(({ data }) => { if (!cancelled) setKupOptions(data ?? []); });
    return () => { cancelled = true; };
  }, [kupQuery]);

  async function save() {
    if (!datum) { setError("Dátum je povinný"); return; }
    if (!isCurrentBuyer && !kupMeno.trim()) { setError("Meno kupujúceho je povinné"); return; }
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = {
        predavajuci_klient_id: isCurrentBuyer ? null : klient.id,
        kupujuci_klient_id: isCurrentBuyer ? klient.id : (kupKlientId || null),
        nehnutelnost_id: nehnId || null,
        kupujuci_meno: isCurrentBuyer ? klient.meno : kupMeno.trim() || null,
        kupujuci_telefon: kupTel.trim() || null,
        kupujuci_email: kupEmail.trim() || null,
        makler_id: myMaklerUuid,
        datum: new Date(datum).toISOString(),
        miesto: miesto || null,
        poznamka: poznamka || null,
        status: "planovana",
      };
      const r = await fetch("/api/obhliadky", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Save zlyhal"); setSaving(false); return; }
      const novaObhliadka = d.obhliadka as Record<string, unknown> | null;
      const kupujuciInfo = d.kupujuci as { klient_id: string; created: boolean; updated: boolean } | null;
      // Krátka spätná väzba — ak bol kupujúci založený alebo aktualizovaný
      if (kupujuciInfo?.created) {
        try { console.info(`[obhliadka] vytvorený nový klient kupujúci ${kupujuciInfo.klient_id}`); } catch {}
      } else if (kupujuciInfo?.updated) {
        try { console.info(`[obhliadka] doplnená karta existujúceho kupujúceho ${kupujuciInfo.klient_id}`); } catch {}
      }

      // Voliteľne — vytvor Google Calendar event a prepoj cez calendar_event_id
      let calendarOk: boolean | null = null; // null = nezvolené, true = OK, false = zlyhalo
      if (createCalendar && authUser?.id && novaObhliadka?.id) {
        try {
          const linkedNehn = inzeraty.find(i => (i as Record<string, unknown>).id === nehnId) as Record<string, unknown> | undefined;
          const summary = isCurrentBuyer
            ? `Obhliadka — ${klient.meno}`
            : `Obhliadka — ${kupMeno || "kupujúci"}${linkedNehn ? ` · ${String(linkedNehn.nazov || "").slice(0, 40)}` : ""}`;
          // Odkaz späť do CRM (obhliadkový list) — kalendár ho zobrazí ako klikateľný link
          const obhliadkaUrl = `${window.location.origin}/obhliadky/${novaObhliadka.id}`;
          const popisLines: string[] = [];
          popisLines.push(`Obhliadkový list: ${obhliadkaUrl}`);
          popisLines.push("");
          popisLines.push(`Obhliadka klienta: ${klient.meno}`);
          if (!isCurrentBuyer) popisLines.push(`Kupujúci: ${kupMeno}${kupTel ? ` · tel ${kupTel}` : ""}${kupEmail ? ` · ${kupEmail}` : ""}`);
          if (linkedNehn) popisLines.push(`Nehnuteľnosť: ${String(linkedNehn.nazov || "")}`);
          if (poznamka) popisLines.push(`Poznámka: ${poznamka}`);
          const startISO = new Date(datum).toISOString();
          const endISO = new Date(new Date(datum).getTime() + 60 * 60 * 1000).toISOString();
          const calRes = await fetch("/api/google/calendar", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: authUser.id,
              summary,
              start: startISO,
              end: endISO,
              location: miesto || (linkedNehn ? String(linkedNehn.lokalita || "") : ""),
              description: popisLines.join("\n"),
            }),
          });
          if (calRes.ok) {
            const calData = await calRes.json();
            const eventId = calData?.event?.id;
            if (eventId) {
              await fetch("/api/obhliadky", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: novaObhliadka.id, calendar_event_id: eventId }),
              });
              calendarOk = true;
            } else {
              calendarOk = false;
            }
          } else {
            calendarOk = false;
            const errBody = await calRes.text().catch(() => "");
            console.warn("[obhliadka calendar] create failed:", calRes.status, errBody);
          }
        } catch (calErr) {
          calendarOk = false;
          console.warn("[obhliadka calendar] failed:", calErr);
        }
      }

      // Ak používateľ chcel kalendár ale zlyhal → upozorni (obhliadka už uložená)
      if (calendarOk === false) {
        setError("Obhliadka uložená, ale Google Kalendár zlyhal. Skontroluj, či je Google Calendar prepojený v Nastaveniach.");
        setSaving(false);
        return;
      }
      // Log do timeline klienta
      try {
        const linkedNehn = inzeraty.find(i => String((i as Record<string,unknown>).id) === nehnId) as Record<string,unknown> | undefined;
        const nehnLabel = linkedNehn
          ? [String(linkedNehn.typ_nehnutelnosti || ""), String(linkedNehn.lokalita || linkedNehn.ulica_privatna || "")].filter(Boolean).join(" · ")
          : "";
        const datumLabel = new Date(datum).toLocaleDateString("sk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
        const popis = [
          `Obhliadka naplánovaná: ${datumLabel}`,
          nehnLabel && `Nehnuteľnosť: ${nehnLabel}`,
          !isCurrentBuyer && kupMeno.trim() && `Kupujúci: ${kupMeno.trim()}`,
          !isCurrentBuyer && kupTel.trim() && `Tel: ${kupTel.trim()}`,
        ].filter(Boolean).join(" · ");
        await fetch("/api/klient-udalosti", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ klient_id: klient.id, typ: "ine", popis }),
        });
      } catch { /* neblokuj */ }
      onCreated();
    } catch (e) {
      setError(String(e).slice(0, 200));
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "20px", padding: "28px",
        maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 6px" }}>Nová obhliadka</h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
          {isCurrentBuyer
            ? <>Obhliadka pre <strong>{klient.meno}</strong> (kupujúci)</>
            : <>Klient <strong>{klient.meno}</strong> (predávajúci) · vyber nehnuteľnosť a údaje kupujúceho</>
          }
        </p>

        {!isCurrentBuyer && inzeraty.length > 0 && (
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Nehnuteľnosť</label>
            <select value={nehnId} onChange={e => setNehnId(e.target.value)} style={{
              width: "100%", padding: "10px 12px", borderRadius: "8px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              color: "var(--text-primary)", fontSize: "14px",
            }}>
              {inzeraty.map(i => {
                const r = i as Record<string, unknown>;
                const typ = String(r.typ_nehnutelnosti || r.druh || "Nehnuteľnosť");
                const adresa = String(r.ulica_privatna || r.lokalita || r.obec || "");
                const cena = r.predajna_cena ? `${Number(r.predajna_cena).toLocaleString("sk")} €` : "";
                const label = [typ, adresa, cena].filter(Boolean).join(" · ") || String(r.nazov || r.id);
                return <option key={String(r.id)} value={String(r.id)}>{label}</option>;
              })}
            </select>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Dátum a čas *</label>
            {(() => {
              const mkAt17 = (offset: number) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                if (d.getDay() === 6) d.setDate(d.getDate() + 2);
                if (d.getDay() === 0) d.setDate(d.getDate() + 1);
                d.setHours(17, 0, 0, 0);
                return d.toISOString().slice(0, 16);
              };
              const chips = [
                { label: "Dnes 17:00", val: mkAt17(0) },
                { label: "Zajtra 17:00", val: mkAt17(1) },
                { label: "Po 17:00", val: (() => { const d = new Date(); const diff = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + diff); d.setHours(17, 0, 0, 0); return d.toISOString().slice(0, 16); })() },
              ];
              return (
                <>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "6px", flexWrap: "wrap" }}>
                    {chips.map(c => (
                      <button key={c.label} type="button" onClick={() => setDatum(c.val)} style={{
                        padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer",
                        background: datum === c.val ? "#374151" : "var(--bg-surface)",
                        color: datum === c.val ? "#fff" : "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}>{c.label}</button>
                    ))}
                  </div>
                  <input type="datetime-local" value={datum} onChange={e => setDatum(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px" }} />
                </>
              );
            })()}
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Miesto stretnutia</label>
            <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
              <button type="button" onClick={() => setMiestoMode("adresa")} style={{
                flex: 1, padding: "6px 8px", fontSize: "11px", fontWeight: "600",
                background: miestoMode === "adresa" ? "#374151" : "var(--bg-elevated)",
                color: miestoMode === "adresa" ? "#fff" : "var(--text-secondary)",
                border: "1px solid " + (miestoMode === "adresa" ? "#374151" : "var(--border)"),
                borderRadius: "6px", cursor: "pointer",
              }}>Z nehnuteľnosti</button>
              <button type="button" onClick={() => setMiestoMode("manual")} style={{
                flex: 1, padding: "6px 8px", fontSize: "11px", fontWeight: "600",
                background: miestoMode === "manual" ? "#374151" : "var(--bg-elevated)",
                color: miestoMode === "manual" ? "#fff" : "var(--text-secondary)",
                border: "1px solid " + (miestoMode === "manual" ? "#374151" : "var(--border)"),
                borderRadius: "6px", cursor: "pointer",
              }}>Ručne</button>
            </div>
            {miestoMode === "adresa" && adresyZNehnutelnosti.length > 0 ? (
              <select value={miesto} onChange={e => setMiesto(e.target.value)} style={{
                width: "100%", padding: "10px 12px", borderRadius: "8px",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                color: "var(--text-primary)", fontSize: "14px",
              }}>
                <option value="">— vyber adresu —</option>
                {adresyZNehnutelnosti.map(a => <option key={a.id} value={a.adresa}>{a.adresa}</option>)}
              </select>
            ) : (
              <input value={miesto} onChange={e => setMiesto(e.target.value)} placeholder="napr. pred bytom, MHD..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px" }} />
            )}
          </div>
        </div>

        {!isCurrentBuyer && (
          <>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 10px" }}>Kupujúci</div>
            <div style={{ position: "relative", marginBottom: "10px" }}>
              <input
                value={kupQuery || kupMeno}
                onChange={e => {
                  setKupQuery(e.target.value);
                  setKupMeno(e.target.value);
                  setKupKlientId(null);
                  setShowKupDropdown(true);
                }}
                onFocus={() => setShowKupDropdown(true)}
                onBlur={() => setTimeout(() => setShowKupDropdown(false), 150)}
                placeholder="Meno a priezvisko *"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px", boxSizing: "border-box" }}
              />
              {showKupDropdown && kupOptions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", zIndex: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", marginTop: "2px" }}>
                  {kupOptions.map(k => (
                    <div key={k.id} onMouseDown={() => {
                      setKupMeno(k.meno);
                      setKupQuery(k.meno);
                      setKupTel(k.telefon || "");
                      setKupEmail(k.email || "");
                      setKupKlientId(k.id);
                      setShowKupDropdown(false);
                    }} style={{ padding: "10px 14px", cursor: "pointer", fontSize: "13px", color: "var(--text-primary)", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 600 }}>{k.meno}</div>
                      {k.telefon && <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{k.telefon}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <input value={kupTel} onChange={e => setKupTel(e.target.value)} placeholder="Telefón"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px" }} />
              <input value={kupEmail} onChange={e => setKupEmail(e.target.value)} placeholder="Email"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px" }} />
            </div>
          </>
        )}

        <div style={{ marginBottom: "14px" }}>
          <textarea value={poznamka} onChange={e => setPoznamka(e.target.value)} placeholder="Poznámka (voliteľné)"
            rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "13px", resize: "vertical" }} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={createCalendar} onChange={e => setCreateCalendar(e.target.checked)} style={{ cursor: "pointer" }} />
          Vytvoriť aj udalosť v mojom Google Kalendári (so 30-min upozornením)
        </label>

        {error && (
          <div style={{ marginBottom: "12px", padding: "10px 12px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "8px", fontSize: "13px", color: "#B91C1C" }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {onBack && (
              <button onClick={onBack} disabled={saving} style={{
                padding: "10px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)",
                cursor: "pointer",
              }}>← Späť</button>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onClose} disabled={saving} style={{ padding: "10px 18px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", cursor: "pointer" }}>Zrušiť</button>
            <button onClick={save} disabled={saving} style={{ padding: "10px 22px", background: "#374151", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Ukladám..." : "Vytvoriť obhliadku"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
