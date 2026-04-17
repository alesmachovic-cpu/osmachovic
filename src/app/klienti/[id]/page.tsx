"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { STATUS_LABELS } from "@/lib/database.types";
import type { Klient } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";
import { useAuth } from "@/components/AuthProvider";
import { getMaklerUuid } from "@/lib/maklerMap";
import { listKlientDokumenty, deleteKlientDokument, type KlientDokument } from "@/lib/klientDokumenty";

// ── LV sekcia s uploadom a parsovaním ──
function LVSection({ klientId, lvData, onParsed, canEdit = true, klientMeno = "", klientLokalita = "", onFixName, onFixLocation }: {
  klientId: string;
  lvData: Record<string, unknown> | null | undefined;
  onParsed: (data: Record<string, unknown>) => void;
  canEdit?: boolean;
  klientMeno?: string;
  klientLokalita?: string;
  onFixName?: (newName: string) => Promise<void>;
  onFixLocation?: (newLokalita: string) => Promise<void>;
}) {
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState("");

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

      // Ulož do klienta
      const { supabase: sb } = await import("@/lib/supabase");
      await sb.from("klienti").update({ lv_data: parsed }).eq("id", klientId);
      onParsed(parsed);
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
  type: "status_change" | "naber" | "objednavka" | "inzerat" | "poznamka" | "system";
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
};

// Workflow kroky
const WORKFLOW_STEPS = [
  { key: "novy_kontakt", label: "Kontakt", icon: "📞", statuses: ["novy", "novy_kontakt", "aktivny"] },
  { key: "dohodnuty_naber", label: "Dohodnutý", icon: "🤝", statuses: ["dohodnuty_naber"] },
  { key: "nabrany", label: "Nabraný", icon: "📝", statuses: ["nabrany"] },
  { key: "inzerovany", label: "Inzerovaný", icon: "📰", statuses: [] },
  { key: "predany", label: "Predaný", icon: "✅", statuses: ["uzavrety"] },
];

export default function KlientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [klient, setKlient] = useState<Klient | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [nabery, setNabery] = useState<Record<string, unknown>[]>([]);
  const [objednavky, setObjednavky] = useState<Record<string, unknown>[]>([]);
  const [inzeraty, setInzeraty] = useState<Record<string, unknown>[]>([]);
  const [activeTab, setActiveTab] = useState<"timeline" | "nabery" | "objednavky" | "dokumenty">("timeline");
  const [klientDokumenty, setKlientDokumenty] = useState<KlientDokument[]>([]);
  useEffect(() => {
    if (!id) return;
    listKlientDokumenty(id).then(setKlientDokumenty);
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
    const [klientRes, naberyRes, objednavkyRes, inzeratyRes] = await Promise.all([
      supabase.from("klienti").select("*").eq("id", id).single(),
      supabase.from("naberove_listy").select("*").eq("klient_id", id).order("created_at", { ascending: false }),
      supabase.from("objednavky").select("*").eq("klient_id", id).order("created_at", { ascending: false }),
      supabase.from("nehnutelnosti").select("*").eq("klient_id", id).order("created_at", { ascending: false }),
    ]);

    if (klientRes.data) setKlient(klientRes.data);
    setNabery(naberyRes.data ?? []);
    setObjednavky(objednavkyRes.data ?? []);
    setInzeraty(inzeratyRes.data ?? []);

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

    // Sort by date desc
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTimeline(events);
    setLoading(false);
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
        <button onClick={() => router.push("/klienti")} style={{
          padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
          borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
        }}>
          ← Späť na klientov
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
    await supabase.from("klienti").update({ status: newStatus }).eq("id", klient.id);
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
      await supabase.from("klienti").update(updates).eq("id", klient.id);
    } else if (isNaber && naberDatum) {
      await supabase.from("klienti").update({ datum_naberu: new Date(naberDatum).toISOString() }).eq("id", klient.id);
    }

    // 2. Vytvor Google Calendar event
    if (naberDatum && user?.id) {
      try {
        const startDt = new Date(naberDatum).toISOString();
        const endDt = new Date(new Date(naberDatum).getTime() + durationMs).toISOString();
        const summary = `${evCfg.label} — ${klient.meno}`;
        const res = await fetch("/api/google/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            summary,
            start: startDt,
            end: endDt,
            description: [
              !isVolat && naberMiesto && `Adresa: ${naberMiesto}`,
              klient.telefon && `Tel: ${klient.telefon}`,
              klient.email && `Email: ${klient.email}`,
            ].filter(Boolean).join("\n"),
            location: isVolat ? "" : naberMiesto,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.event?.id) {
            await supabase.from("klienti").update({ calendar_event_id: data.event.id }).eq("id", klient.id);
          }
        }
      } catch { /* kalendár zlyhá ticho */ }
    }

    setCalendarSyncing(false);
    setShowDatePicker(false);
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
    if (inzeraty.length > 0) return 3;
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
      await supabase.from("klienti").update({ lv_data: parsed }).eq("id", klient.id);
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

      // Rename check
      const majitelia = lv.majitelia as Array<{ meno?: string }> | undefined;
      if (majitelia?.length) {
        const ownerNames: string[] = [];
        for (const m of majitelia.filter(m => m.meno)) {
          const parts = m.meno!.split(/\s+a\s+/i).map(n => n.trim()).filter(n => n.length > 2);
          ownerNames.push(...(parts.length > 1 ? parts : [m.meno!]));
        }
        const currentName = klient.meno.trim().toLowerCase();
        const nameMatch = ownerNames.some(n => n.toLowerCase() === currentName || currentName.includes(n.toLowerCase()) || n.toLowerCase().includes(currentName));
        if (!nameMatch && ownerNames.length > 0) {
          setLvOwnerNames(ownerNames);
          setSelectedLvOwner(ownerNames[0]);
          setShowLVRename(true);
        }
      }
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

  const tabs = [
    { key: "timeline", label: "Aktivita", count: timeline.length },
    { key: "nabery", label: "Nábery", count: nabery.length },
    { key: "objednavky", label: "Objednávky", count: objednavky.length },
    { key: "dokumenty", label: "Dokumenty", count: 0 },
  ];

  return (
    <div style={{ maxWidth: "1050px" }}>
      {/* Header */}
      {/* Breadcrumb navigácia */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", fontSize: "13px" }}>
        <a href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>🏠 Prehľad</a>
        <span style={{ color: "var(--text-muted)" }}>›</span>
        <a href="/klienti" style={{ color: "var(--text-muted)", textDecoration: "none" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>Klienti</a>
        <span style={{ color: "var(--text-muted)" }}>›</span>
        <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{klient.meno}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button onClick={() => router.push("/klienti")} style={{
          width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--border)",
          background: "var(--bg-surface)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
            Karta klienta
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Všetky informácie a história
          </p>
        </div>
        {isOwner ? (
          <button onClick={() => setEditModal(true)} style={{
            padding: "9px 18px", background: "var(--bg-surface)", color: "var(--text-primary)",
            border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px",
            fontWeight: "600", cursor: "pointer",
          }}>
            ✏️ Upraviť
          </button>
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

      {/* Klient karta — hlavné info */}
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
            {klient.lokalita && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                📍 {klient.lokalita}
              </span>
            )}
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
                await supabase.from("klienti").update({ makler_id: e.target.value || null }).eq("id", klient.id);
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
                  await supabase.from("klienti").update({ spolupracujuci_makler_id: null, spolupracujuci_provizia_pct: null }).eq("id", klient.id);
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
      {(klient.typ === "predavajuci" || klient.typ === "oboje") && (
        <div style={{
          ...cardSt, marginBottom: "20px", padding: "16px 20px",
        }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Pipeline predávajúceho
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
            {WORKFLOW_STEPS.map((ws, i) => {
              const isCompleted = i < workflowStep;
              const isCurrent = i === workflowStep;
              const dotColor = isCompleted || isCurrent ? "#374151" : "var(--border)";
              return (
                <div key={ws.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flex: 1,
                  }}>
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "50%",
                      background: isCompleted || isCurrent ? "#374151" : "var(--bg-elevated)",
                      color: isCompleted || isCurrent ? "#fff" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: "700",
                      border: `1px solid ${dotColor}`,
                      transition: "all 0.2s",
                      boxShadow: isCurrent ? "0 0 0 3px rgba(29,29,31,0.08)" : "none",
                    }}>
                      {isCompleted ? "✓" : i + 1}
                    </div>
                    <span style={{
                      fontSize: "11px", fontWeight: isCurrent ? "600" : "500",
                      color: isCurrent ? "var(--text-primary)" : "var(--text-muted)",
                    }}>{ws.label}</span>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div style={{
                      height: "1px", flex: "0 0 100%", maxWidth: "48px",
                      background: isCompleted ? "#374151" : "var(--border)",
                      marginBottom: "20px",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
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
            <button onClick={() => router.push(`/inzerat?klient_id=${klient.id}`)} style={{
              marginTop: "14px", width: "100%", padding: "11px", background: "#374151", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>📰 Vytvoriť inzerát</button>
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
                if (Object.keys(updates).length > 0) {
                  const { supabase: sb } = await import("@/lib/supabase");
                  await sb.from("klienti").update(updates).eq("id", klient.id);
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
                if (!selectedLvOwner) return;
                const { supabase: sb } = await import("@/lib/supabase");
                await sb.from("klienti").update({ meno: selectedLvOwner }).eq("id", klient.id);
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

      {/* Rýchle akcie */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px",
      }} className="cards-grid">
        {klient.typ === "kupujuci" ? (
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
        ) : (
          <button onClick={() => router.push(`/inzerat?klient_id=${klient.id}`)} style={{
            padding: "14px", background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "12px", cursor: "pointer", textAlign: "center",
            transition: "border-color 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#374151"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <div style={{ fontSize: "16px", marginBottom: "4px", opacity: 0.7 }}>📰</div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>Inzerát</div>
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
        <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)} style={{
          padding: "14px", background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "12px", cursor: "pointer", textAlign: "center",
          transition: "border-color 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#374151"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
        >
          <div style={{ fontSize: "16px", marginBottom: "4px", opacity: 0.7 }}>📝</div>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>Vyplniť náberový list</div>
        </button>
      </div>

      {/* Štatistiky klienta */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px",
      }} className="cards-grid">
        {[
          { label: "Nábery", value: nabery.length },
          { label: "Objednávky", value: objednavky.length },
          { label: "Inzeráty", value: inzeraty.length },
          { label: "Obhliadky", value: 0 },
        ].map(s => (
          <div key={s.label} style={{
            padding: "18px 16px", borderRadius: "12px",
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Taby */}
      <div style={{
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
          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "20px" }}>
            📅 Časová os
          </div>
          {timeline.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              Žiadna aktivita
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {/* Vertikálna čiara */}
              <div style={{
                position: "absolute", left: "19px", top: "8px", bottom: "8px",
                width: "2px", background: "var(--border)",
              }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {timeline.map(ev => {
                  const isClickable = ev.type === "naber" || ev.type === "objednavka";
                  return (
                    <div key={ev.id}
                      onClick={() => {
                        if (ev.type === "naber") setActiveTab("nabery");
                        else if (ev.type === "objednavka") setActiveTab("objednavky");
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
                        </div>
                        {ev.detail && (
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
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
          )}
        </div>
      )}

      {activeTab === "nabery" && (
        <div style={cardSt}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
              📝 Náberové listy
            </div>
            <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)} style={{
              padding: "6px 14px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>+ Vyplniť náberový list</button>
          </div>
          {nabery.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              Žiadne nábery
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {nabery.map((n: Record<string, unknown>) => {
                const adresa = [n.ulica, n.cislo_orientacne, n.obec, n.okres].filter(Boolean).map(String).join(", ");
                return (
                  <div key={n.id as string} style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 16px", borderRadius: "10px", background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: "#F5F3FF", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "18px", flexShrink: 0,
                    }}>📝</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
                        {String(n.typ_nehnutelnosti || "—")}
                        {n.plocha ? <span style={{ fontWeight: "400", color: "var(--text-muted)" }}> · {String(n.plocha)} m²</span> : ""}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {adresa || "—"}
                      </div>
                      {!!n.predajna_cena && (
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)", marginTop: "2px" }}>
                          {Number(n.predajna_cena).toLocaleString("sk")} €
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(n.created_at as string).toLocaleDateString("sk")}
                      </div>
                      <button onClick={() => {
                        setPendingStatus(null);
                        setShowDatePicker(true);
                      }} style={{
                        padding: "3px 8px", background: "#F5F3FF", border: "1px solid #DDD6FE",
                        borderRadius: "6px", fontSize: "10px", fontWeight: "600", color: "#7C3AED",
                        cursor: "pointer",
                      }}>
                        📅 Kalendár
                      </button>
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
            <button onClick={() => router.push("/kupujuci")} style={{
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
              {objednavky.map((o: Record<string, unknown>) => (
                <div key={o.id as string} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "14px 16px", borderRadius: "10px", background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
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
                      {o.cena_do ? `Max: ${Number(o.cena_do).toLocaleString("sk")} €` : "—"}
                    </div>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(o.created_at as string).toLocaleDateString("sk")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "dokumenty" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* LV sekcia */}
          <LVSection
            klientId={klient.id}
            lvData={klient.lv_data}
            canEdit={!!isOwner}
            klientMeno={klient.meno || ""}
            klientLokalita={klient.lokalita || ""}
            onFixName={async (newName) => {
              await supabase.from("klienti").update({ meno: newName }).eq("id", klient.id);
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
              await supabase.from("klienti").update({ lokalita: newLok }).eq("id", klient.id);
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
          {/* Ostatné dokumenty */}
          <div style={cardSt}>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>
              📁 Dokumenty ({klientDokumenty.length})
            </div>
            {klientDokumenty.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                Žiadne dokumenty. Nahrané v náberáku, inzeráte alebo rezervácii sa zobrazia tu.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {klientDokumenty.map(d => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "10px" }}>
                    <span style={{ fontSize: "18px" }}>📄</span>
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
                          style={{ fontSize: "12px", color: "var(--accent, #3B82F6)", background: "none", padding: "4px 10px", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>
                          👁 Zobraziť
                        </button>
                        <a href={`data:${d.mime || "application/octet-stream"};base64,${d.data_base64}`} download={d.name}
                           style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none", padding: "4px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}>
                          ⬇ Stiahnuť
                        </a>
                      </>
                    )}
                    {isAdmin && (
                      <button onClick={async () => { if (d.id && confirm("Vymazať dokument?")) { await deleteKlientDokument(d.id); setKlientDokumenty(prev => prev.filter(x => x.id !== d.id)); } }}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }}>×</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
                  <button key={o.v} onClick={() => setEventType(o.v as typeof eventType)} style={{
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
                await supabase.from("klienti").update({
                  spolupracujuci_makler_id: spolupracaMakler,
                  spolupracujuci_provizia_pct: spolupracaPct,
                }).eq("id", klient.id);
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

    </div>
  );
}
