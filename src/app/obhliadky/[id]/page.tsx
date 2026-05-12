"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SignatureCanvas from "@/components/SignatureCanvas";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/components/AuthProvider";

type Obhliadka = {
  id: string;
  predavajuci_klient_id?: string | null;
  kupujuci_klient_id?: string | null;
  nehnutelnost_id?: string | null;
  kupujuci_meno?: string | null;
  kupujuci_telefon?: string | null;
  kupujuci_email?: string | null;
  datum: string;
  miesto?: string | null;
  poznamka?: string | null;
  status: string;
  podpis_data?: string | null;
  podpis_datum?: string | null;
  email_sent_at?: string | null;
  email_sent_to?: string | null;
  gdpr_consent?: boolean | null;
  gdpr_consent_at?: string | null;
  podpis_meta?: Record<string, unknown> | null;
};

export default function ObhliadkaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id;

  const [obhliadka, setObhliadka] = useState<Obhliadka | null>(null);
  const [nehnutelnost, setNehnutelnost] = useState<Record<string, unknown> | null>(null);
  const [predKlient, setPredKlient] = useState<Record<string, unknown> | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sentMsg, setSentMsg] = useState("");
  const [emailOverride, setEmailOverride] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/obhliadky?klient_id=`).then(r => r.json()).then(async d => {
      const all = (d.obhliadky || []) as Obhliadka[];
      const found = all.find(o => o.id === id);
      if (found) {
        setObhliadka(found);
        setEmailOverride(found.kupujuci_email || "");
        if (found.nehnutelnost_id) {
          const nr = await fetch(`/api/nehnutelnosti?id=${found.nehnutelnost_id}`).then(r => r.json()).catch(() => null);
          if (nr?.nehnutelnost) setNehnutelnost(nr.nehnutelnost as Record<string, unknown>);
        }
        if (found.predavajuci_klient_id) {
          const kr = await fetch(`/api/klienti?id=${found.predavajuci_klient_id}`).then(r => r.json()).catch(() => null);
          if (kr?.klient) setPredKlient(kr.klient as Record<string, unknown>);
        }
      } else {
        setError("Obhliadka nenájdená");
      }
    });
  }, [id]);

  async function ulozPodpis() {
    if (!signature) { setError("Najprv podpíš v poli"); return; }
    if (!gdprConsent) { setError("Súhlas so spracovaním osobných údajov je povinný"); return; }
    if (!obhliadka) return;
    setSaving(true); setError("");
    // Audit metadata — IP zaznamená server (req headers), tu zachytíme klientske údaje
    const podpis_meta = {
      gdpr_version: "v1.0",
      consent_evidence: true,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : null,
    };
    try {
      const r = await fetch("/api/obhliadky", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: obhliadka.id,
          podpis_data: signature,
          podpis_datum: new Date().toISOString(),
          status: "prebehla",
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          podpis_meta,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Save zlyhal"); setSaving(false); return; }
      setObhliadka(d.obhliadka);
      setSentMsg("✓ Podpis uložený");
    } catch (e) {
      setError(String(e).slice(0, 200));
    }
    setSaving(false);
  }

  async function odoslatEmail() {
    if (!obhliadka) return;
    const to = emailOverride.trim();
    if (!to) { setError("Zadaj email kupujúceho"); return; }
    if (!obhliadka.podpis_data) { setError("Najprv podpíš obhliadku"); return; }
    setSaving(true); setError(""); setSentMsg("");
    try {
      const r = await fetch("/api/obhliadky/pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          obhliadkaId: obhliadka.id,
          to,
          maklerEmail: user?.email || undefined,
          maklerMeno: user?.name || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Email zlyhal"); setSaving(false); return; }
      setSentMsg(`✓ Email odoslaný na ${to}`);
      // Refresh obhliadka
      const refreshR = await fetch(`/api/obhliadky?klient_id=`);
      const refreshD = await refreshR.json();
      const found = (refreshD.obhliadky || []).find((o: Obhliadka) => o.id === obhliadka.id);
      if (found) setObhliadka(found);
    } catch (e) {
      setError(String(e).slice(0, 200));
    }
    setSaving(false);
  }

  if (!obhliadka) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
        {error || "Načítavam..."}
      </div>
    );
  }

  const dt = new Date(obhliadka.datum);
  const isPodpisana = !!obhliadka.podpis_data;

  return (
    <div style={{ maxWidth: "720px" }}>
      <BackButton />

      <div style={{ background: "var(--bg-surface)", borderRadius: "16px", border: "1px solid var(--border)", padding: "28px", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 6px" }}>
          Obhliadkový list
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
          {dt.toLocaleString("sk", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Predávajúci</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{predKlient ? String(predKlient.meno) : "—"}</div>
            {predKlient?.telefon ? <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{String(predKlient.telefon)}</div> : null}
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Kupujúci</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{obhliadka.kupujuci_meno || "—"}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {obhliadka.kupujuci_telefon ? <>📱 {obhliadka.kupujuci_telefon}<br /></> : null}
              {obhliadka.kupujuci_email ? <>✉️ {obhliadka.kupujuci_email}</> : null}
            </div>
          </div>
        </div>

        {nehnutelnost && (
          <div style={{ padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: "10px", marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Nehnuteľnosť</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{String(nehnutelnost.nazov || "")}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              {String(nehnutelnost.lokalita || "")} · {nehnutelnost.cena ? Number(nehnutelnost.cena).toLocaleString("sk") + " €" : "—"}
            </div>
          </div>
        )}

        {obhliadka.miesto && (
          <div style={{ marginBottom: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
            <strong>Miesto stretnutia:</strong> {obhliadka.miesto}
          </div>
        )}

        <div style={{ padding: "14px 16px", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "10px", marginBottom: "16px", fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
          <strong>Vyhlásenie kupujúceho:</strong> Týmto potvrdzujem, že nehnuteľnosť som obhliadol/a v sprievode realitného makléra
          spoločnosti VIANEMA. Beriem na vedomie, že akékoľvek ďalšie rokovanie ohľadom predaja tejto nehnuteľnosti budem viesť výhradne
          prostredníctvom tejto realitnej kancelárie.
        </div>

        {/* GDPR — explicitný súhlas pred podpisom. Veľký marginBottom zabraňuje
            accidentálnemu unchecknutiu pri kreslení podpisu na mobile. */}
        {!isPodpisana && (
          <label style={{
            display: "flex", alignItems: "flex-start", gap: "10px",
            padding: "12px 14px", background: "var(--bg-elevated)",
            border: gdprConsent ? "1px solid #10B981" : "1px solid var(--border)",
            borderRadius: "10px", marginBottom: "32px", cursor: "pointer",
            fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5,
            pointerEvents: gdprConsent ? "none" : "auto",
            opacity: gdprConsent ? 0.85 : 1,
          }}>
            <input
              type="checkbox"
              checked={gdprConsent}
              onChange={e => setGdprConsent(e.target.checked)}
              readOnly={gdprConsent}
              style={{ marginTop: "2px", cursor: gdprConsent ? "default" : "pointer", flexShrink: 0 }}
            />
            <span>
              {gdprConsent && <strong style={{ color: "#065F46" }}>✓ Súhlas udelený · </strong>}
              Súhlasím so spracovaním mojich osobných údajov spoločnosťou Vianema s. r. o.
              v zmysle GDPR pre účely evidencie obhliadok. Plné znenie zásad spracovania
              nájdete v dokumente{" "}
              <a href="/gdpr" target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: "var(--accent, #3B82F6)", textDecoration: "underline", pointerEvents: "auto" }}>
                Zásady spracovania osobných údajov →
              </a>
            </span>
          </label>
        )}
        {isPodpisana && obhliadka.gdpr_consent && (
          <div style={{
            padding: "10px 14px", background: "#ECFDF5", border: "1px solid #A7F3D0",
            borderRadius: "10px", marginBottom: "16px", fontSize: "11px", color: "#065F46",
          }}>
            ✓ GDPR súhlas udelený {obhliadka.gdpr_consent_at ? new Date(obhliadka.gdpr_consent_at).toLocaleString("sk") : ""} ·
            {" "}<a href="/gdpr" target="_blank" rel="noopener noreferrer"
              style={{ color: "#065F46", textDecoration: "underline" }}>Zásady spracovania</a>
          </div>
        )}

        {isPodpisana ? (
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Podpis kupujúceho
            </div>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", display: "flex", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={obhliadka.podpis_data || ""} alt="Podpis" style={{ maxHeight: "120px" }} />
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
              ✓ Podpísané {obhliadka.podpis_datum ? new Date(obhliadka.podpis_datum).toLocaleString("sk") : ""}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Podpis kupujúceho
            </div>
            <SignatureCanvas onSignatureChange={setSignature} />
            <button onClick={ulozPodpis} disabled={saving || !signature || !gdprConsent}
              style={{
                marginTop: "10px", padding: "10px 18px",
                background: (signature && gdprConsent) ? "#374151" : "#E5E7EB",
                color: (signature && gdprConsent) ? "#fff" : "#9CA3AF",
                border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
                cursor: (signature && gdprConsent && !saving) ? "pointer" : "not-allowed",
              }}
              title={!gdprConsent ? "Najprv označ súhlas s GDPR" : !signature ? "Najprv podpíš v poli" : ""}
            >
              {saving ? "Ukladám..." : "✓ Uložiť podpis"}
            </button>
          </div>
        )}
      </div>

      {/* Email sekcia — len ak je podpísané */}
      {isPodpisana && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "16px", border: "1px solid var(--border)", padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 12px" }}>📧 Odoslať kupujúcemu</h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input value={emailOverride} onChange={e => setEmailOverride(e.target.value)} placeholder="email@kupujuceho.sk"
              style={{ flex: 1, minWidth: "240px", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px" }} />
            <button onClick={odoslatEmail} disabled={saving || !emailOverride.trim()}
              style={{ padding: "10px 20px", background: "#374151", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Odosielam..." : "✉️ Odoslať PDF"}
            </button>
            <a href={`/api/obhliadky/pdf?id=${obhliadka.id}`} target="_blank" rel="noopener"
              style={{ padding: "10px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", textDecoration: "none" }}>
              ⬇ Stiahnuť PDF
            </a>
          </div>
          {obhliadka.email_sent_at && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px" }}>
              ✓ Posledne odoslané {new Date(obhliadka.email_sent_at).toLocaleString("sk")} na {obhliadka.email_sent_to}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ padding: "12px 16px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "10px", fontSize: "13px", color: "#B91C1C", marginBottom: "12px" }}>⚠️ {error}</div>}
      {sentMsg && <div style={{ padding: "12px 16px", background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "10px", fontSize: "13px", color: "#166534", marginBottom: "12px" }}>{sentMsg}</div>}
    </div>
  );
}
