"use client";

import { use, useEffect, useState } from "react";

interface PageMeta {
  entity_type: "naber" | "objednavka";
  entity_id: string;
  expires_at: string;
  telefon_masked: string;
  entity_meta: Record<string, unknown>;
  error?: string;
}

export default function PodpisPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/sign/verify?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setMeta(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSign() {
    setError("");
    if (otp.length !== 6) { setError("Kód musí mať 6 číslic"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/sign/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp, signature_data: `SMS-OTP signed ${new Date().toISOString()}` }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || `Chyba HTTP ${r.status}`); setSubmitting(false); return; }
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: "440px",
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(40px)",
        borderRadius: "24px",
        border: "1px solid rgba(255,255,255,0.12)",
        padding: "36px 32px",
        boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            fontSize: "22px", fontWeight: 500, letterSpacing: "-0.03em", color: "#fff",
          }}>VIANEMA</div>
          <div style={{ fontSize: "9px", letterSpacing: "0.4em", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>REAL</div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", padding: "20px 0" }}>
            Načítavam...
          </div>
        )}

        {!loading && error && !done && (
          <div style={{
            padding: "16px", borderRadius: "12px",
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#fecaca", fontSize: "13px", textAlign: "center",
          }}>
            ❌ {error}
          </div>
        )}

        {!loading && meta && !done && (
          <>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "0 0 6px", textAlign: "center" }}>
              Podpis dokumentu
            </h1>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", textAlign: "center", margin: "0 0 24px" }}>
              {meta.entity_type === "naber" ? "Náberový list" : "Objednávka kupujúceho"} · Vianema Real
            </p>

            {/* Sumár dokumentu */}
            <div style={{
              padding: "14px 16px", borderRadius: "12px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              marginBottom: "20px",
            }}>
              {meta.entity_type === "naber" && (
                <>
                  {meta.entity_meta.majitel ? <Row label="Majiteľ" value={String(meta.entity_meta.majitel)} /> : null}
                  {meta.entity_meta.typ_nehnutelnosti ? <Row label="Typ" value={String(meta.entity_meta.typ_nehnutelnosti)} /> : null}
                  {meta.entity_meta.obec ? <Row label="Obec" value={String(meta.entity_meta.obec)} /> : null}
                  {meta.entity_meta.ulica ? <Row label="Adresa" value={`${meta.entity_meta.ulica} ${meta.entity_meta.supisne_cislo || ""}`.trim()} /> : null}
                  {meta.entity_meta.plocha ? <Row label="Plocha" value={`${meta.entity_meta.plocha} m²`} /> : null}
                  {meta.entity_meta.predajna_cena ? <Row label="Predajná cena" value={`${Number(meta.entity_meta.predajna_cena).toLocaleString("sk")} €`} /> : null}
                </>
              )}
              {meta.entity_type === "objednavka" && (
                <>
                  {meta.entity_meta.druh ? <Row label="Druh" value={String(meta.entity_meta.druh)} /> : null}
                  {meta.entity_meta.cena_do ? <Row label="Cena do" value={`${Number(meta.entity_meta.cena_do).toLocaleString("sk")} €`} /> : null}
                  {meta.entity_meta.lokalita ? <Row label="Lokalita" value={typeof meta.entity_meta.lokalita === "string" ? meta.entity_meta.lokalita : JSON.stringify(meta.entity_meta.lokalita)} /> : null}
                </>
              )}
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Overovací kód (6 číslic)
              </label>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="• • • • • •"
                disabled={submitting}
                style={{
                  width: "100%", padding: "16px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff", fontSize: "24px", letterSpacing: "0.4em",
                  textAlign: "center", outline: "none", fontFamily: "monospace",
                }} />
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "8px", textAlign: "center" }}>
                Kód sme poslali na {meta.telefon_masked} · platí 15 min
              </p>
            </div>

            {error && (
              <div style={{
                marginTop: "12px", padding: "10px 12px", borderRadius: "10px",
                background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#fecaca", fontSize: "12px",
              }}>{error}</div>
            )}

            <button
              onClick={handleSign}
              disabled={submitting || otp.length !== 6}
              style={{
                width: "100%", marginTop: "16px",
                padding: "14px 16px", borderRadius: "12px",
                background: "#fff", color: "#111827",
                border: "none", fontSize: "14px", fontWeight: 700,
                cursor: (submitting || otp.length !== 6) ? "default" : "pointer",
                opacity: (submitting || otp.length !== 6) ? 0.5 : 1,
              }}>
              {submitting ? "Podpisujem..." : "Súhlasím a podpisujem"}
            </button>

            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "16px", lineHeight: "1.5", textAlign: "center" }}>
              Podpisom potvrdzujete súhlas s obsahom dokumentu. IP adresa, čas
              a overovací kód sa logujú pre audit.
            </p>
          </>
        )}

        {done && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
              Podpísané
            </h2>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
              Ďakujeme. Maklér Vianema vám čo najskôr odpovie.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "12px", padding: "4px 0", fontSize: "12px" }}>
      <span style={{ color: "rgba(255,255,255,0.5)", minWidth: "100px" }}>{label}</span>
      <span style={{ color: "#fff", fontWeight: 500, flex: 1 }}>{value}</span>
    </div>
  );
}
