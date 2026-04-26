"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DuplicateInfo {
  id: string;
  nazov?: string;
  ulica?: string;
  cislo?: string;
  lokalita?: string;
  makler_meno?: string;
}

/**
 * Pre-check modal pri "+ Pridať nehnuteľnosť" v karte klienta.
 *
 * Cieľ: rýchle overenie či nehnuteľnosť na danej adrese už neexistuje
 * PRED otvorením dlhého náberového formulára. Maklér zadá iba 4 polia
 * (typ, obec, ulica, súpisné číslo), systém ho upozorní ak je duplicita.
 *
 * Po confirm prechádza na /naber?klient_id=X&typ=...&obec=...&ulica=...&cislo=...
 * (NaberyForm prefilluje tieto polia z query params).
 */
export default function NovaNehnutelnostModal({
  klientId, klientMeno, onClose,
}: {
  klientId: string;
  klientMeno: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [typ, setTyp] = useState<"byt" | "dom" | "pozemok" | "garaz" | "komercia" | "">("");
  const [obec, setObec] = useState("");
  const [ulica, setUlica] = useState("");
  const [supisneCislo, setSupisneCislo] = useState("");
  const [linkInzerat, setLinkInzerat] = useState("");

  // Realtime kontrola duplicate adresy (debounced 600ms)
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ulica.trim() || !supisneCislo.trim() || !obec.trim()) {
      setDuplicates([]);
      setChecked(false);
      return;
    }
    setChecking(true);
    setChecked(false);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/kolize/nehnutelnosti", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ulica_privatna: ulica.trim(),
            supisne_cislo: supisneCislo.trim(),
            lokalita: obec.trim(),
          }),
        });
        const out = await res.json().catch(() => ({}));
        const exact = (out.kolize || []).filter((k: { typ?: string }) => k.typ === "PRESNA_ADRESA");
        setDuplicates(exact.map((k: { data?: Record<string, unknown> }) => ({
          id: String(k.data?.existujuca_nehnutelnost_id || ""),
          nazov: k.data?.nazov as string | undefined,
          ulica: k.data?.ulica as string | undefined,
          cislo: k.data?.cislo as string | undefined,
          lokalita: k.data?.lokalita as string | undefined,
          makler_meno: k.data?.makler_a_meno as string | undefined,
        })));
        setChecked(true);
      } catch { /* silent */ }
      setChecking(false);
    }, 600);
    return () => clearTimeout(t);
  }, [ulica, supisneCislo, obec]);

  function pokracovat() {
    if (!typ || !obec.trim()) return;
    const params = new URLSearchParams({
      klient_id: klientId,
      typ: typ,
      obec: obec.trim(),
    });
    if (ulica.trim()) params.set("ulica", ulica.trim());
    if (supisneCislo.trim()) params.set("supisne_cislo", supisneCislo.trim());
    if (linkInzerat.trim()) params.set("link", linkInzerat.trim());
    router.push(`/naber?${params.toString()}`);
  }

  const canSubmit = typ && obec.trim().length > 1;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "16px",
        padding: "24px", maxWidth: "520px", width: "100%",
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
          Pridať nehnuteľnosť
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 18px" }}>
          Pre klienta <strong style={{ color: "var(--text-primary)" }}>{klientMeno}</strong> · najprv overíme či
          nehnuteľnosť na tejto adrese už nemáme
        </p>

        {/* Typ nehnuteľnosti */}
        <div style={{ marginBottom: "14px" }}>
          <label style={lblSt}>Typ nehnuteľnosti *</label>
          <select value={typ} onChange={e => setTyp(e.target.value as typeof typ)} style={inputSt}>
            <option value="">— vyberte —</option>
            <option value="byt">Byt</option>
            <option value="dom">Dom</option>
            <option value="pozemok">Pozemok</option>
            <option value="garaz">Garáž</option>
            <option value="komercia">Komercia</option>
          </select>
        </div>

        {/* Mesto/Obec */}
        <div style={{ marginBottom: "14px" }}>
          <label style={lblSt}>Mesto / Obec * <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(nie ulica)</span></label>
          <input type="text" value={obec} onChange={e => setObec(e.target.value)}
            placeholder="napr. Bratislava, Košice, Nitra…" style={inputSt} />
        </div>

        {/* Ulica + Súpisné číslo */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "14px" }}>
          <div>
            <label style={lblSt}>Ulica</label>
            <input type="text" value={ulica} onChange={e => setUlica(e.target.value)}
              placeholder="napr. Romanova" style={inputSt} />
          </div>
          <div>
            <label style={lblSt}>Súpisné číslo</label>
            <input type="text" value={supisneCislo} onChange={e => setSupisneCislo(e.target.value)}
              placeholder="napr. 24" style={inputSt} />
          </div>
        </div>

        {/* Realtime kontrola — status banner */}
        {(ulica && supisneCislo && obec) && (
          <div style={{
            padding: "12px 14px", borderRadius: "10px", marginBottom: "16px",
            fontSize: "13px",
            background: checking ? "var(--bg-elevated)"
              : duplicates.length > 0 ? "#FEE2E2" : checked ? "#ECFDF5" : "var(--bg-elevated)",
            border: "1px solid " + (checking ? "var(--border)"
              : duplicates.length > 0 ? "#FCA5A5" : checked ? "#A7F3D0" : "var(--border)"),
            color: checking ? "var(--text-secondary)"
              : duplicates.length > 0 ? "#991B1B" : checked ? "#065F46" : "var(--text-muted)",
          }}>
            {checking ? (
              <>⏳ Overujem či adresa neexistuje…</>
            ) : duplicates.length > 0 ? (
              <>
                <strong>⚠️ Adresa už existuje v systéme:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
                  {duplicates.map(d => (
                    <li key={d.id} style={{ marginTop: "4px" }}>
                      <strong>{d.nazov || `${d.ulica} ${d.cislo}, ${d.lokalita}`}</strong>
                      {d.makler_meno && <> · maklér: {d.makler_meno}</>}
                      {d.id && (
                        <a href={`/portfolio?id=${d.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft: "8px", color: "#991B1B", textDecoration: "underline", fontWeight: 600 }}>
                          Otvoriť →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.85 }}>
                  Odporúčame namiesto duplikovania <strong>otvoriť existujúcu nehnuteľnosť</strong>. Ak je to chyba, môžeš pokračovať aj tak.
                </div>
              </>
            ) : checked ? (
              <>✓ Adresa je voľná — môžeš pokračovať na vyplnenie náberového listu</>
            ) : null}
          </div>
        )}

        {/* Voliteľný link na inzerát */}
        <div style={{ marginBottom: "20px" }}>
          <label style={lblSt}>Odkaz na existujúci inzerát <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(voliteľné)</span></label>
          <input type="url" value={linkInzerat} onChange={e => setLinkInzerat(e.target.value)}
            placeholder="https://nehnutelnosti.sk/… alebo realit.sk/…" style={inputSt} />
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Link na inzerát — studený náber, Google Maps pin
          </div>
        </div>

        {/* Akcie */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", background: "var(--bg-elevated)",
            color: "var(--text-secondary)", border: "1px solid var(--border)",
            borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>Zrušiť</button>
          <button onClick={pokracovat} disabled={!canSubmit} style={{
            padding: "10px 20px",
            background: canSubmit ? "#374151" : "#9CA3AF",
            color: "#fff", border: "none", borderRadius: "10px",
            fontSize: "13px", fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed",
          }}>
            {duplicates.length > 0 ? "Pokračovať aj tak →" : "Pokračovať na náberák →"}
          </button>
        </div>
      </div>
    </div>
  );
}

const lblSt: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700,
  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em",
  marginBottom: "6px",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "8px", fontSize: "14px", color: "var(--text-primary)",
  outline: "none",
};
