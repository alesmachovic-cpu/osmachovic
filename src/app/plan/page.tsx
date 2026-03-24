"use client";

import { useState } from "react";

interface Feature {
  name: string;
  desc: string;
  status: "done" | "wip" | "planned" | "future";
  route?: string;
}

interface Phase {
  title: string;
  icon: string;
  color: string;
  features: Feature[];
}

const PHASES: Phase[] = [
  {
    title: "Základy CRM",
    icon: "🏗️",
    color: "#059669",
    features: [
      { name: "Dashboard s prehľadom", desc: "Mesačné ciele, activity kruhy, štatistiky", status: "done", route: "/" },
      { name: "Zoznam klientov", desc: "Evidencia predávajúcich a kupujúcich klientov", status: "done", route: "/klienti" },
      { name: "Karta klienta", desc: "Detail klienta s históriou aktivít, nábery, objednávky", status: "done", route: "/klienti" },
      { name: "Nový klient s duplikáciou", desc: "Smart detekcia duplicitných klientov", status: "done" },
      { name: "Overenie čísla", desc: "Automatické overenie telefónneho čísla", status: "done", route: "/" },
      { name: "Nastavenia", desc: "Mesačné ciele, cenový odhad, Google integrácia", status: "done", route: "/nastavenia" },
      { name: "Responzívny dizajn", desc: "Mobile, tablet, desktop — hamburger menu, bottom tabs", status: "done" },
    ],
  },
  {
    title: "Nábery a objednávky",
    icon: "📝",
    color: "#8B5CF6",
    features: [
      { name: "Náberový list", desc: "Digitálny formulár namiesto papiera — byt, dom, pozemok", status: "done", route: "/naber" },
      { name: "Podpis klienta", desc: "Digitálny podpis na mobile aj PC", status: "done" },
      { name: "Typ inzercie", desc: "Inkognito, online web, online, výhradné", status: "done" },
      { name: "Cenový odhad + výkup", desc: "Auto kalkulácia z m² × cena, rekonštrukcia, marža", status: "done" },
      { name: "Checklist dokumentov", desc: "LV, energetický certifikát, pôdorys — foto", status: "done" },
      { name: "Záväzná objednávka kupujúceho", desc: "Multi-select lokality, izby, typy", status: "done", route: "/kupujuci" },
      { name: "Povinná provízia", desc: "Nemôže uložiť náber bez výšky provízie", status: "done" },
    ],
  },
  {
    title: "Inzercia a portfólio",
    icon: "📰",
    color: "#3B82F6",
    features: [
      { name: "Tvorba inzerátu", desc: "Na základe vyplneného náberu", status: "done", route: "/inzerat" },
      { name: "AI Writer", desc: "Generovanie popisu nehnuteľnosti cez AI", status: "done", route: "/ai-writer" },
      { name: "Portfólio nehnuteľností", desc: "Prehľad všetkých nehnuteľností v ponuke", status: "done", route: "/portfolio" },
      { name: "Ponuka vyžaduje náber", desc: "Nemôže vytvoriť ponuku bez náberového listu", status: "done", route: "/inzerat" },
      { name: "Pipeline Klient→Náber→Inzerát→Predaj", desc: "Celý flow prepojený", status: "done" },
      { name: "Štatistiky nehnuteľností", desc: "Vizuál ako počasie/akcie na iPhone", status: "done", route: "/statistiky" },
    ],
  },
  {
    title: "Matching a vyhľadávanie",
    icon: "🔗",
    color: "#0891B2",
    features: [
      { name: "Matching ponúk", desc: "Automatické zhody kupujúci ↔ ponuky", status: "done", route: "/matching" },
      { name: "Scraping externých portálov", desc: "Nehnutelnosti.sk, reality.sk — ponuky zvonku", status: "done", route: "/portfolio" },
      { name: "Notifikácia o zhode", desc: "Automatické upozornenie pri novej zhode", status: "done", route: "/notifikacie" },
    ],
  },
  {
    title: "Komunikácia a kalendár",
    icon: "📅",
    color: "#F59E0B",
    features: [
      { name: "Google Calendar sync", desc: "Kalendár widget na dashboarde + MCP sync", status: "done", route: "/" },
      { name: "Gmail integrácia", desc: "Maily s klientom priamo v karte klienta", status: "done", route: "/gmail" },
      { name: "Inteligentné upozornenia", desc: "Denné upozornenia podľa aktivity klientov", status: "done", route: "/upozornenia" },
      { name: "Obhliadky a termíny", desc: "Evidencia obhliadok viazaná na nehnuteľnosť", status: "done", route: "/obhliadky" },
    ],
  },
  {
    title: "Produkcia a operatíva",
    icon: "⚙️",
    color: "#EF4444",
    features: [
      { name: "Nákladové položky", desc: "Evidencia nákladov na nehnuteľnosť", status: "done", route: "/naklady" },
      { name: "Objednávky produkcie", desc: "Kanban board — zmluvy, fotograf, právnik", status: "done", route: "/produkcia" },
      { name: "Vyťaženosť fotografa/právnika", desc: "Kapacita tímu, dostupnosť, zákazky", status: "done", route: "/vytazenost" },
      { name: "Potvrdenie provízie pri rezervácii", desc: "Odsúhlasenie pri zmene na 'rezervované'", status: "done", route: "/potvrdenie-provizii" },
      { name: "Viac maklérov na klientovi", desc: "Tímový pohľad, každý vidí svoje", status: "done", route: "/tim" },
    ],
  },
  {
    title: "Analýzy a reporty",
    icon: "📊",
    color: "#6366F1",
    features: [
      { name: "Analýza trhu", desc: "Porovnanie cien v lokalite", status: "done", route: "/analyzy" },
      { name: "Kalkulátor", desc: "Hypotekárny kalkulátor, ROI, yield", status: "done", route: "/kalkulator" },
      { name: "Pipeline dashboard", desc: "Klienti → nábery → inzeráty → predané", status: "done", route: "/" },
      { name: "Manažérsky pohľad", desc: "KPI, konverzie, výkon tímu", status: "done", route: "/manazer" },
      { name: "Klientská zóna", desc: "Portál pre klienta s prehľadom nehnuteľností", status: "done", route: "/klientska-zona" },
    ],
  },
];

const STATUS_CONFIG = {
  done: { label: "Hotové", bg: "#F0FDF4", color: "#059669", border: "#BBF7D0", icon: "✓" },
  wip: { label: "Pracuje sa", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE", icon: "⏳" },
  planned: { label: "Plánované", bg: "#FEF3C7", color: "#D97706", border: "#FDE68A", icon: "📋" },
  future: { label: "Vízia", bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB", icon: "💡" },
};

export default function PlanPage() {
  const [filter, setFilter] = useState<"all" | "done" | "wip" | "planned" | "future">("all");

  const totalFeatures = PHASES.reduce((a, p) => a + p.features.length, 0);
  const doneFeatures = PHASES.reduce((a, p) => a + p.features.filter(f => f.status === "done").length, 0);
  const wipFeatures = PHASES.reduce((a, p) => a + p.features.filter(f => f.status === "wip").length, 0);
  const progressPct = Math.round((doneFeatures / totalFeatures) * 100);

  return (
    <div style={{ maxWidth: "900px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
          Plán systému
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
          Kompletná mapa funkcií OS Machovič — čo funguje a čo príde
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px",
        padding: "20px", marginBottom: "20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
            Celkový progres
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#059669" }}>{progressPct}%</div>
        </div>
        <div style={{ height: "10px", background: "var(--bg-elevated)", borderRadius: "5px", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progressPct}%`,
            background: "linear-gradient(90deg, #059669, #10B981)",
            borderRadius: "5px", transition: "width 0.5s",
          }} />
        </div>
        <div style={{ display: "flex", gap: "20px", marginTop: "14px", fontSize: "12px" }}>
          <span style={{ color: "#059669", fontWeight: "600" }}>✓ {doneFeatures} hotových</span>
          <span style={{ color: "#2563EB", fontWeight: "600" }}>⏳ {wipFeatures} rozpracovaných</span>
          <span style={{ color: "#D97706", fontWeight: "600" }}>📋 {totalFeatures - doneFeatures - wipFeatures} plánovaných</span>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
        {[
          { key: "all", label: "Všetko" },
          { key: "done", label: `✓ Hotové (${doneFeatures})` },
          { key: "wip", label: `⏳ Rozpracované (${wipFeatures})` },
          { key: "planned", label: "📋 Plánované" },
          { key: "future", label: "💡 Vízia" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)} style={{
            padding: "6px 14px", borderRadius: "20px", cursor: "pointer",
            background: filter === f.key ? "#374151" : "var(--bg-surface)",
            color: filter === f.key ? "#fff" : "var(--text-primary)",
            border: filter === f.key ? "none" : "1px solid var(--border)",
            fontSize: "12px", fontWeight: "600", transition: "all 0.15s",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Fázy */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {PHASES.map(phase => {
          const filteredFeatures = filter === "all"
            ? phase.features
            : phase.features.filter(f => f.status === filter);

          if (filteredFeatures.length === 0) return null;

          const phaseDone = phase.features.filter(f => f.status === "done").length;
          const phasePct = Math.round((phaseDone / phase.features.length) * 100);

          return (
            <div key={phase.title} style={{
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "14px", overflow: "hidden",
            }}>
              {/* Fáza header */}
              <div style={{
                padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px",
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: `${phase.color}15`, border: `2px solid ${phase.color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", flexShrink: 0,
                }}>{phase.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
                    {phase.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {phaseDone} / {phase.features.length} hotových
                  </div>
                </div>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "50%",
                  background: `conic-gradient(${phase.color} ${phasePct * 3.6}deg, var(--bg-elevated) 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%", background: "var(--bg-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", fontWeight: "800", color: phase.color,
                  }}>{phasePct}%</div>
                </div>
              </div>

              {/* Features */}
              <div>
                {filteredFeatures.map((f, i) => {
                  const sc = STATUS_CONFIG[f.status];
                  return (
                    <div key={f.name} style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      padding: "12px 20px",
                      borderBottom: i < filteredFeatures.length - 1 ? "1px solid var(--border)" : "none",
                      cursor: f.route ? "pointer" : "default",
                      transition: "background 0.1s",
                    }}
                      onClick={() => { if (f.route) window.location.href = f.route; }}
                      onMouseEnter={e => { if (f.route) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{
                        width: "24px", height: "24px", borderRadius: "6px",
                        background: sc.bg, border: `1px solid ${sc.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "11px", flexShrink: 0, color: sc.color,
                        fontWeight: "700",
                      }}>{sc.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
                          {f.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                          {f.desc}
                        </div>
                      </div>
                      <span style={{
                        fontSize: "10px", fontWeight: "700", padding: "3px 8px",
                        borderRadius: "10px", background: sc.bg, color: sc.color,
                        border: `1px solid ${sc.border}`, whiteSpace: "nowrap",
                      }}>{sc.label}</span>
                      {f.route && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
