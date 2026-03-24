"use client";

import { useState } from "react";

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  status: "done" | "active" | "pending";
}

const TIMELINE: TimelineEvent[] = [
  {
    id: "1",
    date: "2026-03-10",
    title: "Náber uložený",
    detail: "Sprostredkovateľská zmluva podpísaná, nehnuteľnosť zaradená do ponuky.",
    status: "done",
  },
  {
    id: "2",
    date: "2026-03-14",
    title: "Fotodokumentácia hotová",
    detail: "Profesionálne fotografie a pôdorys nehnuteľnosti pripravené.",
    status: "done",
  },
  {
    id: "3",
    date: "2026-03-16",
    title: "Inzerát vytvorený",
    detail: "Nehnuteľnosť publikovaná na portáloch Reality.sk, Nehnutelnosti.sk a Bazos.sk.",
    status: "done",
  },
  {
    id: "4",
    date: "2026-03-22",
    title: "Obhliadka plánovaná",
    detail: "Naplánovaná obhliadka s potenciálnym kupujúcim na 26. marca o 14:00.",
    status: "active",
  },
  {
    id: "5",
    date: "",
    title: "Ponuka / vyjednávanie",
    detail: "Čaká sa na ponuky od záujemcov.",
    status: "pending",
  },
  {
    id: "6",
    date: "",
    title: "Podpis kúpnej zmluvy",
    detail: "Príprava a podpis kúpnej zmluvy u notára.",
    status: "pending",
  },
];

const STATUS_STYLES: Record<string, { dot: string; line: string; textColor: string }> = {
  done: { dot: "#059669", line: "#059669", textColor: "var(--text-secondary)" },
  active: { dot: "#374151", line: "#D1D5DB", textColor: "var(--text-primary)" },
  pending: { dot: "#D1D5DB", line: "#D1D5DB", textColor: "var(--text-muted)" },
};

export default function KlientskaZonaPage() {
  const [activeTab, setActiveTab] = useState<"prehlad" | "dokumenty" | "kontakt">("prehlad");

  return (
    <div>
      {/* Demo banner */}
      <div
        style={{
          padding: "12px 20px",
          background: "#FEF3C7",
          border: "1px solid #FDE68A",
          borderRadius: "10px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span style={{ fontSize: "16px" }}>&#9888;</span>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
            Toto je ukážka klientskej zóny
          </div>
          <div style={{ fontSize: "12px", color: "#A16207" }}>
            Náhľad toho, čo uvidí váš klient po prihlásení do portálu.
          </div>
        </div>
      </div>

      <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
        Klientská zóna
      </h1>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 24px" }}>
        Prehľad vašej nehnuteľnosti a priebehu predaja
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
        {[
          { key: "prehlad" as const, label: "Prehľad" },
          { key: "dokumenty" as const, label: "Dokumenty" },
          { key: "kontakt" as const, label: "Kontakt" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
              background: activeTab === tab.key ? "#374151" : "var(--bg-surface)",
              color: activeTab === tab.key ? "#fff" : "var(--text-secondary)",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Prehľad tab */}
      {activeTab === "prehlad" && (
        <>
          {/* Property card */}
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              overflow: "hidden",
              marginBottom: "24px",
            }}
          >
            {/* Photo placeholder */}
            <div
              style={{
                height: "200px",
                background: "linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "40px", opacity: 0.5 }}>&#127968;</span>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Fotogaléria nehnuteľnosti</span>
            </div>

            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
                    3-izbový byt, Dunajská ulica
                  </h2>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    Bratislava - Staré Mesto &middot; 78 m² &middot; 3. poschodie
                  </div>
                </div>
                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#059669",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                  }}
                >
                  V predaji
                </div>
              </div>

              <div style={{ fontSize: "26px", fontWeight: "700", color: "#374151", marginBottom: "16px" }}>
                249 000 &euro;
              </div>

              {/* Property details */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {[
                  { label: "Izby", value: "3" },
                  { label: "Plocha", value: "78 m²" },
                  { label: "Poschodie", value: "3/8" },
                  { label: "Stav", value: "Pôvodný" },
                ].map((d) => (
                  <div
                    key={d.label}
                    style={{
                      padding: "12px",
                      background: "var(--bg-elevated)",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>{d.label}</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>{d.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
              Priebeh predaja
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 24px" }}>
              Sledujte, v akom stave sa nachádza predaj vašej nehnuteľnosti
            </p>

            <div style={{ position: "relative" }}>
              {TIMELINE.map((event, i) => {
                const st = STATUS_STYLES[event.status];
                const isLast = i === TIMELINE.length - 1;
                return (
                  <div key={event.id} style={{ display: "flex", gap: "16px", marginBottom: isLast ? 0 : "24px", position: "relative" }}>
                    {/* Dot and line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "20px", flexShrink: 0 }}>
                      <div
                        style={{
                          width: event.status === "active" ? "14px" : "10px",
                          height: event.status === "active" ? "14px" : "10px",
                          borderRadius: "50%",
                          background: st.dot,
                          border: event.status === "active" ? "3px solid #E5E7EB" : "none",
                          flexShrink: 0,
                          marginTop: "4px",
                        }}
                      />
                      {!isLast && (
                        <div
                          style={{
                            width: "2px",
                            flex: 1,
                            background: st.line,
                            marginTop: "4px",
                          }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: st.textColor }}>
                          {event.title}
                        </div>
                        {event.date && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {new Date(event.date).toLocaleDateString("sk", { day: "numeric", month: "long" })}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                        {event.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Dokumenty tab */}
      {activeTab === "dokumenty" && (
        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            padding: "24px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 20px" }}>
            Dokumenty
          </h3>
          {[
            { name: "Sprostredkovateľská zmluva", date: "10. marca 2026", type: "PDF" },
            { name: "Fotodokumentácia", date: "14. marca 2026", type: "ZIP" },
            { name: "Pôdorys bytu", date: "14. marca 2026", type: "PDF" },
          ].map((doc, i) => (
            <div
              key={doc.name}
              style={{
                padding: "14px 0",
                borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{doc.name}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{doc.date}</div>
              </div>
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#374151",
                  background: "#F3F4F6",
                }}
              >
                {doc.type}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kontakt tab */}
      {activeTab === "kontakt" && (
        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            padding: "24px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 20px" }}>
            Váš maklér
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "700",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              AM
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                Aleš Machovič
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Realitný maklér &middot; Vianema</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: "Telefón", value: "+421 900 000 000", href: "tel:+421900000000" },
              { label: "Email", value: "ales@vianema.sk", href: "mailto:ales@vianema.sk" },
              { label: "Kancelária", value: "Bratislava, Staré Mesto", href: undefined },
            ].map((c) => (
              <div key={c.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{c.label}</div>
                {c.href ? (
                  <a
                    href={c.href}
                    style={{ fontSize: "13px", fontWeight: "600", color: "#374151", textDecoration: "none" }}
                  >
                    {c.value}
                  </a>
                ) : (
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{c.value}</div>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              background: "var(--bg-elevated)",
              borderRadius: "10px",
              fontSize: "12px",
              color: "var(--text-muted)",
              lineHeight: "1.6",
            }}
          >
            Ak máte akékoľvek otázky ohľadom predaja vašej nehnuteľnosti, neváhajte ma kontaktovať.
            Som tu pre vás počas pracovných dní od 8:00 do 18:00.
          </div>
        </div>
      )}
    </div>
  );
}
