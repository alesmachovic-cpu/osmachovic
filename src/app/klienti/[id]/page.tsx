"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { STATUS_LABELS } from "@/lib/database.types";
import type { Klient } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";
import { useAuth } from "@/components/AuthProvider";

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [naberDatum, setNaberDatum] = useState("");
  const [calendarSyncing, setCalendarSyncing] = useState(false);

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

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
    if (
      (newStatus === "dohodnuty_naber" && klient.status !== "dohodnuty_naber") ||
      (newStatus === "volat_neskor")
    ) {
      // Otvor datetime picker pre dohodnutie termínu náberu alebo volať neskôr
      setPendingStatus(newStatus);
      setShowDatePicker(true);
      return;
    }
    // Pre ostatné statusy — len update
    await supabase.from("klienti").update({ status: newStatus }).eq("id", klient.id);
    loadAll();
  }

  // Po potvrdení dátumu — vytvor calendar event + update status + redirect
  async function handleDateConfirm() {
    if (!klient) return;
    setCalendarSyncing(true);

    const isVolatNeskor = pendingStatus === "volat_neskor";
    const isDohodnutyNaber = pendingStatus === "dohodnuty_naber" || !pendingStatus;

    // 1. Update status a dátum
    const updates: Record<string, unknown> = { status: pendingStatus || "dohodnuty_naber" };
    if (naberDatum && !isVolatNeskor) updates.datum_naberu = new Date(naberDatum).toISOString();
    await supabase.from("klienti").update(updates).eq("id", klient.id);

    // 2. Vytvor Google Calendar event cez user OAuth
    if (naberDatum && user?.id) {
      try {
        const startDt = new Date(naberDatum).toISOString();
        const adresa = klient.lokalita || "";
        const summary = isVolatNeskor
          ? `Zavolať — ${klient.meno}`
          : `Náber — ${klient.meno}`;
        const res = await fetch("/api/google/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            summary,
            start: startDt,
            description: [
              adresa && `Adresa: ${adresa}`,
              klient.telefon && `Tel: ${klient.telefon}`,
              klient.email && `Email: ${klient.email}`,
            ].filter(Boolean).join("\n"),
            location: isVolatNeskor ? "" : adresa,
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
    setPendingStatus(null);
    setNaberDatum("");

    if (isVolatNeskor) {
      // Len reload, žiaden redirect
      loadAll();
    } else {
      // Zostať v karte klienta, len reload
      loadAll();
    }
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
        <button onClick={() => setEditModal(true)} style={{
          padding: "9px 18px", background: "var(--bg-surface)", color: "var(--text-primary)",
          border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px",
          fontWeight: "600", cursor: "pointer",
        }}>
          ✏️ Upraviť
        </button>
      </div>

      {/* Klient karta — hlavné info */}
      <div style={{
        ...cardSt, marginBottom: "20px",
        display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "20px", alignItems: "center",
      }} className="dash-grid">
        {/* Avatar */}
        <div style={{
          width: "72px", height: "72px", borderRadius: "50%",
          background: "#374151", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", fontWeight: "800", flexShrink: 0,
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
            style={{
              padding: "6px 28px 6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "700",
              background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30`,
              cursor: "pointer", appearance: "none",
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
              outline: "none",
            }}
          >
            {[
              { value: "aktivny", label: "Aktívny" },
              { value: "novy_kontakt", label: "Nový kontakt" },
              { value: "dohodnuty_naber", label: "Dohodnutý náber" },
              { value: "nabrany", label: "Nabraný" },
              { value: "volat_neskor", label: "Volať neskôr" },
              { value: "nedovolal", label: "Nedovolal" },
              { value: "nechce_rk", label: "Nechce RK" },
              { value: "uz_predal", label: "Už predal" },
              { value: "realitna_kancelaria", label: "Realitná kancelária" },
            ].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span style={{
            padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "600",
            background: "#F3F4F6", color: "#374151",
          }}>
            {TYP_LABELS[klient.typ] || klient.typ}
          </span>
        </div>
      </div>

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
              return (
                <div key={ws.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1,
                  }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: isCompleted ? "#059669" : isCurrent ? "#374151" : "var(--bg-elevated)",
                      color: isCompleted || isCurrent ? "#fff" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: isCompleted ? "14px" : "16px", fontWeight: "700",
                      border: isCurrent ? "2px solid #374151" : isCompleted ? "2px solid #059669" : "2px solid var(--border)",
                      transition: "all 0.2s",
                    }}>
                      {isCompleted ? "✓" : ws.icon}
                    </div>
                    <span style={{
                      fontSize: "10px", fontWeight: isCurrent ? "700" : "500",
                      color: isCompleted ? "#059669" : isCurrent ? "var(--text-primary)" : "var(--text-muted)",
                    }}>{ws.label}</span>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div style={{
                      height: "2px", flex: "0 0 100%", maxWidth: "40px",
                      background: isCompleted ? "#059669" : "var(--border)",
                      marginBottom: "18px",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Akčné tlačidlo podľa kroku */}
          {workflowStep === 0 && (
            <button onClick={() => handleStatusChange("dohodnuty_naber")} style={{
              marginTop: "12px", width: "100%", padding: "10px", background: "#374151", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>🤝 Dohodnúť náber</button>
          )}
          {workflowStep === 1 && (
            <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)} style={{
              marginTop: "12px", width: "100%", padding: "10px", background: "#374151", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>📝 Vyplniť náberový list</button>
          )}
          {workflowStep === 2 && (
            <button onClick={() => router.push(`/inzerat?klient_id=${klient.id}`)} style={{
              marginTop: "12px", width: "100%", padding: "10px", background: "#374151", color: "#fff",
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
            <div style={{ fontSize: "22px", marginBottom: "4px" }}>📋</div>
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
            <div style={{ fontSize: "22px", marginBottom: "4px" }}>📰</div>
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
          <div style={{ fontSize: "22px", marginBottom: "4px" }}>📞</div>
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
          <div style={{ fontSize: "22px", marginBottom: "4px" }}>📅</div>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>Kalendár</div>
        </button>
        <button onClick={() => router.push(`/naber?klient_id=${klient.id}`)} style={{
          padding: "14px", background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "12px", cursor: "pointer", textAlign: "center",
          transition: "border-color 0.15s", opacity: 0.6,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.opacity = "0.6"; }}
        >
          <div style={{ fontSize: "22px", marginBottom: "4px" }}>📝</div>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>Nový náber</div>
        </button>
      </div>

      {/* Štatistiky klienta */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px",
      }} className="cards-grid">
        {[
          { label: "Nábery", value: nabery.length, icon: "📝", bg: "#F5F3FF" },
          { label: "Objednávky", value: objednavky.length, icon: "📋", bg: "#ECFDF5" },
          { label: "Inzeráty", value: inzeraty.length, icon: "📰", bg: "#EFF6FF" },
          { label: "Obhliadky", value: 0, icon: "👁️", bg: "#FEF3C7" },
        ].map(s => (
          <div key={s.label} style={{
            padding: "16px", borderRadius: "12px", background: s.bg,
            textAlign: "center",
          }}>
            <div style={{ fontSize: "20px", marginBottom: "4px" }}>{s.icon}</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-primary)" }}>{s.value}</div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>{s.label}</div>
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
            <button onClick={() => router.push("/naber")} style={{
              padding: "6px 14px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>+ Nový náber</button>
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
        <div style={cardSt}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>
            📁 Dokumenty
          </div>
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
            Dokumenty budú dostupné čoskoro — LV, zmluvy, certifikáty
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
        }} onClick={() => { setShowDatePicker(false); setPendingStatus(null); setNaberDatum(""); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "20px", padding: "32px",
            maxWidth: "400px", width: "100%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%", background: "#F5F3FF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "24px", margin: "0 auto 16px", border: "2px solid #DDD6FE",
            }}>📅</div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
              {pendingStatus === "dohodnuty_naber" ? "Kedy bude náber?" : pendingStatus === "volat_neskor" ? "Kedy zavolať?" : "Pridať do kalendára"}
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
              {pendingStatus === "dohodnuty_naber"
                ? <>Termín stretnutia s <strong style={{ color: "var(--text-primary)" }}>{klient.meno}</strong></>
                : pendingStatus === "volat_neskor"
                ? <>Pripomienka na zavolanie <strong style={{ color: "var(--text-primary)" }}>{klient.meno}</strong></>
                : <>Nová udalosť pre <strong style={{ color: "var(--text-primary)" }}>{klient.meno}</strong></>
              }
            </p>
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
              <button onClick={() => { setShowDatePicker(false); setPendingStatus(null); setNaberDatum(""); }} style={{
                padding: "10px 24px", background: "var(--bg-elevated)",
                color: "var(--text-secondary)", border: "1px solid var(--border)",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>Zrušiť</button>
              <button disabled={calendarSyncing} onClick={async () => {
                if (pendingStatus === "dohodnuty_naber" || pendingStatus === "volat_neskor") {
                  await handleDateConfirm();
                } else {
                  // Len pridať do kalendára
                  if (naberDatum && user?.id) {
                    setCalendarSyncing(true);
                    try {
                      await fetch("/api/google/calendar", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: user.id,
                          summary: `${klient.meno} — stretnutie`,
                          start: new Date(naberDatum).toISOString(),
                          description: [klient.lokalita && `Adresa: ${klient.lokalita}`, klient.telefon && `Tel: ${klient.telefon}`].filter(Boolean).join("\n"),
                          location: klient.lokalita || "",
                        }),
                      });
                    } catch { /* ticho */ }
                    setCalendarSyncing(false);
                  }
                  setShowDatePicker(false);
                  setNaberDatum("");
                }
              }} style={{
                padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                opacity: calendarSyncing ? 0.6 : 1,
              }}>
                {calendarSyncing ? "Ukladám..." : pendingStatus === "dohodnuty_naber" ? "Potvrdiť a pokračovať →" : pendingStatus === "volat_neskor" ? "Uložiť pripomienku" : "Pridať do kalendára"}
              </button>
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
          }}
          onClose={() => setEditModal(false)}
          onSaved={() => { setEditModal(false); loadAll(); }}
        />
      )}
    </div>
  );
}
