"use client";
import { useState } from "react";

interface Owner {
  meno: string;
  datum_nar: string;
  rodne_cislo: string;
  bytom: string;
  kontakt: string;
}

interface Props {
  klientId: string;
  naberId?: string;
  // Pre-fill dáta z LV a náberáku
  prefill: {
    owners: Array<{ meno?: string; datum_nar?: string; kontakt?: string }>;
    obec: string;
    provizia: string;
    predajnaCena: string;
  };
  onClose: () => void;
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box",
};
const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px", display: "block",
};

export default function VyhradnaZmluvaModal({ klientId, naberId, prefill, onClose }: Props) {
  const ownerCount = Math.max(1, prefill.owners.filter(o => o.meno).length);

  const [owners, setOwners] = useState<Owner[]>(() =>
    [0, 1, 2].map(i => ({
      meno: prefill.owners[i]?.meno ?? "",
      datum_nar: prefill.owners[i]?.datum_nar ?? "",
      rodne_cislo: "",
      bytom: "",
      kontakt: prefill.owners[i]?.kontakt ?? "",
    }))
  );

  const [provizia, setProvizia] = useState(prefill.provizia);
  const [proviziaText, setProviziaText] = useState("");
  const [mesiacov, setMesiacov] = useState("6");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setOwnerField(i: number, field: keyof Owner, val: string) {
    setOwners(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: val } : o));
  }

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const overrides: Record<string, string> = {
        zmluva_mesiacov: mesiacov,
        provizia: provizia,
        provizia_slovom: proviziaText,
      };
      owners.forEach((o, i) => {
        const n = i + 1;
        if (o.meno) overrides[`z${n}_meno`] = o.meno;
        if (o.datum_nar) overrides[`z${n}_datum_nar`] = o.datum_nar;
        if (o.rodne_cislo) overrides[`z${n}_rodne_cislo`] = o.rodne_cislo;
        if (o.bytom) overrides[`z${n}_bytom`] = o.bytom;
        if (o.kontakt) overrides[`z${n}_kontakt`] = o.kontakt;
      });

      const res = await fetch("/api/zmluva/vyhradna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klient_id: klientId, naber_id: naberId, overrides }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Chyba pri generovaní");
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "vyhradna-zmluva.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const activeOwners = owners.slice(0, ownerCount);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--bg-surface)", borderRadius: "16px", padding: "24px",
        width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: "700" }}>Výhradná zmluva</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Doplň chýbajúce údaje — zmluva sa vygeneruje ako .docx
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>×</button>
        </div>

        {/* Vlastníci */}
        {activeOwners.map((o, i) => (
          <div key={i} style={{ marginBottom: "20px", padding: "14px", background: "var(--bg-elevated)", borderRadius: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase" }}>
              Predávajúci {ownerCount > 1 ? i + 1 : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelSt}>Meno a priezvisko</label>
                <input style={inputSt} value={o.meno} onChange={e => setOwnerField(i, "meno", e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Dátum narodenia</label>
                <input style={inputSt} value={o.datum_nar} onChange={e => setOwnerField(i, "datum_nar", e.target.value)} placeholder="DD.MM.RRRR" />
              </div>
              <div>
                <label style={labelSt}>Rodné číslo</label>
                <input style={inputSt} value={o.rodne_cislo} onChange={e => setOwnerField(i, "rodne_cislo", e.target.value)} placeholder="XXXXXX/XXXX" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelSt}>Bytom (trvalé bydlisko)</label>
                <input style={inputSt} value={o.bytom} onChange={e => setOwnerField(i, "bytom", e.target.value)} placeholder="Ulica č., Obec" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelSt}>Email, telefón</label>
                <input style={inputSt} value={o.kontakt} onChange={e => setOwnerField(i, "kontakt", e.target.value)} />
              </div>
            </div>
          </div>
        ))}

        {/* Zmluva parametre */}
        <div style={{ marginBottom: "20px", padding: "14px", background: "var(--bg-elevated)", borderRadius: "10px" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase" }}>
            Parametre zmluvy
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={labelSt}>Trvanie zmluvy (mesiace)</label>
              <input style={inputSt} type="number" min="1" value={mesiacov} onChange={e => setMesiacov(e.target.value)} />
            </div>
            <div>
              <label style={labelSt}>Provízia (€ alebo %)</label>
              <input style={inputSt} value={provizia} onChange={e => setProvizia(e.target.value)} placeholder="napr. 3% alebo 5000" />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelSt}>Provízia slovom</label>
              <input style={inputSt} value={proviziaText} onChange={e => setProviziaText(e.target.value)} placeholder="napr. tri percentá z kúpnej ceny" />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", color: "#991B1B", fontSize: "13px", marginBottom: "14px" }}>
            {error}
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading}
          style={{
            width: "100%", padding: "13px", background: loading ? "#6B7280" : "#374151",
            color: "#fff", border: "none", borderRadius: "10px",
            fontSize: "14px", fontWeight: "600", cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Generujem..." : "⬇ Stiahnuť výhradnú zmluvu (.docx)"}
        </button>
      </div>
    </div>
  );
}
