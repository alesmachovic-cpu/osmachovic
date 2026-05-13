"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type MyData = {
  user: Record<string, unknown> | null;
  klienti: unknown[];
  obhliadky: unknown[];
};

export default function TransparencyPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [eraseMsg, setEraseMsg] = useState("");

  async function loadMyData() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/gdpr/export?user_id=${user.id}`, { credentials: "include" });
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }

  async function requestErasure() {
    if (!user?.id || !confirm("Naozaj chcete požiadať o anonymizáciu Vašich dát? Táto akcia sa nedá vziať späť.")) return;
    setErasing(true);
    try {
      const r = await fetch("/api/gdpr/erasure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: user.id }),
      });
      if (r.ok) {
        setEraseMsg("Žiadosť odoslaná. Spracujeme ju do 30 dní a informujeme Vás e-mailom.");
      } else {
        setEraseMsg("Chyba pri odosielaní žiadosti. Kontaktujte privacy@vianema.sk");
      }
    } finally {
      setErasing(false);
    }
  }

  function downloadJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "moje-data-vianema.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: "780px", margin: "0 auto", padding: "0 0 80px" }}>
      <h1 style={h1St}>Moje dáta — Transparency</h1>
      <p style={metaSt}>Právo na prenositeľnosť (čl. 20 GDPR) · Právo na vymazanie (čl. 17 GDPR)</p>

      {!user ? (
        <div style={{ ...cardSt, marginTop: "24px" }}>
          <p style={pSt}>Pre zobrazenie Vašich dát sa prosím <a href="/prihlasenie" style={lnkSt}>prihláste</a>.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "10px", margin: "24px 0", flexWrap: "wrap" }}>
            <button onClick={loadMyData} disabled={loading} style={btnPrimary}>
              {loading ? "Načítavam…" : "Zobraziť moje dáta"}
            </button>
            {data && (
              <button onClick={downloadJson} style={btnSecondary}>
                Stiahnuť JSON
              </button>
            )}
          </div>

          {data && (
            <div style={cardSt}>
              <h2 style={h2St}>Vaše dáta v systéme</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <Stat label="Profil" value="1 záznam" />
                <Stat label="Klienti" value={`${(data.klienti || []).length} záznamov`} />
                <Stat label="Obhliadky" value={`${(data.obhliadky || []).length} záznamov`} />
              </div>
              <details>
                <summary style={{ cursor: "pointer", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                  Zobraziť surové dáta (JSON)
                </summary>
                <pre style={{ fontSize: "11px", background: "var(--bg-base)", padding: "12px", borderRadius: "8px", overflowX: "auto", color: "var(--text-secondary)", maxHeight: "400px", overflowY: "auto" }}>
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            </div>
          )}

          <div style={{ ...cardSt, marginTop: "16px", borderColor: "var(--danger)" }}>
            <h2 style={{ ...h2St, color: "var(--danger)" }}>Žiadosť o vymazanie / anonymizáciu</h2>
            <p style={pSt}>
              Podľa čl. 17 GDPR máte právo na vymazanie Vašich osobných údajov. Niektoré údaje
              (faktúry, AML doklady) musíme zo zákona uchovávať — tie budú anonymizované, nie vymazané.
              Spracovanie žiadosti trvá do 30 dní.
            </p>
            {eraseMsg ? (
              <p style={{ fontSize: "14px", color: "var(--success)", fontWeight: 600 }}>{eraseMsg}</p>
            ) : (
              <button onClick={requestErasure} disabled={erasing} style={{ ...btnPrimary, background: "var(--danger)" }}>
                {erasing ? "Odosielam…" : "Požiadať o anonymizáciu dát"}
              </button>
            )}
          </div>

          <div style={{ ...cardSt, marginTop: "16px" }}>
            <h2 style={h2St}>Stav bezpečnosti</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
              <Stat label="Dátové úniky" value="0" />
              <Stat label="Aktívne sessions" value="Vaša aktuálna" />
              <Stat label="Posledný pentest" value="[doplniť]" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-base)", borderRadius: "8px", padding: "12px" }}>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: "16px" }}>{value}</div>
    </div>
  );
}

const h1St: React.CSSProperties = { fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" };
const h2St: React.CSSProperties = { fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px" };
const metaSt: React.CSSProperties = { fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" };
const pSt: React.CSSProperties = { fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "12px" };
const lnkSt: React.CSSProperties = { color: "var(--accent)", textDecoration: "none" };
const cardSt: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" };
const btnPrimary: React.CSSProperties = { background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", fontWeight: 600, cursor: "pointer" };
