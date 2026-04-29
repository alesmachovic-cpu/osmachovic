"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchDodavatel } from "@/app/nastavenia/faktury/page";
import { useAuth } from "@/components/AuthProvider";

type Odberatel = {
  id: string;
  nazov: string;
  adresa: string | null;
  ico: string | null;
  dic: string | null;
  ic_dph: string | null;
};

type Polozka = {
  popis: string;
  mnozstvo: string;
  jednotka: string;
  cena_jednotka: string;
  spolu: number;
};

const inputSt: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "14px",
};
const labelSt: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "4px",
};

function addDays(d: string, n: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

export default function NovaFakturaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [odberatelia, setOdberatelia] = useState<Odberatel[]>([]);
  const [odberatelId, setOdberatelId] = useState<string>("");
  const odb = odberatelia.find((o) => o.id === odberatelId) || null;

  const [datumVystavenia, setDatumVystavenia] = useState(today);
  const [datumDodania, setDatumDodania] = useState(today);
  const [datumSplatnosti, setDatumSplatnosti] = useState(addDays(today, 14));
  const [formaUhrady, setFormaUhrady] = useState("Prevodom");
  const [poznamka, setPoznamka] = useState("");

  const [polozky, setPolozky] = useState<Polozka[]>([
    { popis: "", mnozstvo: "1", jednotka: "ks", cena_jednotka: "", spolu: 0 },
  ]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/odberatelia").then((r) => r.json()).then((d) => {
      setOdberatelia(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setOdberatelId(d[0].id);
    });
    if (user?.id) {
      fetchDodavatel(user.id).then((dod) => {
        if (dod.splatnost_dni) setDatumSplatnosti(addDays(today, dod.splatnost_dni));
        if (dod.poznamka_default) setPoznamka(dod.poznamka_default);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function updatePolozka(i: number, patch: Partial<Polozka>) {
    setPolozky((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      const m = parseFloat(String(next[i].mnozstvo).replace(",", ".")) || 0;
      const c = parseFloat(String(next[i].cena_jednotka).replace(",", ".")) || 0;
      next[i].spolu = m * c;
      return next;
    });
  }
  function addPolozka() {
    setPolozky((p) => [...p, { popis: "", mnozstvo: "1", jednotka: "ks", cena_jednotka: "", spolu: 0 }]);
  }
  function removePolozka(i: number) {
    setPolozky((p) => p.filter((_, idx) => idx !== i));
  }

  const sumaCelkom = polozky.reduce((s, p) => s + (p.spolu || 0), 0);

  async function save() {
    if (!odb) return alert("Vyber odberateľa");
    if (!user?.id) return alert("Nie si prihlásený");
    if (polozky.every((p) => !p.popis.trim())) return alert("Pridaj aspoň jednu položku");
    setSaving(true);
    const r = await fetch("/api/faktury", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        odberatel_id: odb.id,
        odberatel_snapshot: odb,
        datum_vystavenia: datumVystavenia,
        datum_dodania: datumDodania,
        datum_splatnosti: datumSplatnosti,
        forma_uhrady: formaUhrady,
        suma_bez_dph: sumaCelkom,
        dph: 0,
        poznamka,
        polozky: polozky.filter((p) => p.popis.trim()).map((p) => ({
          popis: p.popis,
          mnozstvo: parseFloat(String(p.mnozstvo).replace(",", ".")) || 0,
          jednotka: p.jednotka,
          cena_jednotka: parseFloat(String(p.cena_jednotka).replace(",", ".")) || 0,
          spolu: p.spolu,
        })),
      }),
    });
    setSaving(false);
    if (!r.ok) {
      const e = await r.json();
      return alert("Chyba: " + (e.error || ""));
    }
    const created = await r.json();
    router.push(`/faktury/${created.id}`);
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151" }}>Nová faktúra</h1>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>Číslo a VS sa vygenerujú automaticky</div>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }} className="dash-grid">
          <div>
            <div style={labelSt}>Odberateľ *</div>
            <select style={inputSt} value={odberatelId} onChange={(e) => setOdberatelId(e.target.value)}>
              {odberatelia.length === 0 && <option value="">— najprv pridaj odberateľa —</option>}
              {odberatelia.map((o) => (
                <option key={o.id} value={o.id}>{o.nazov}</option>
              ))}
            </select>
            {odb && (
              <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <div>{odb.adresa}</div>
                <div>IČO: {odb.ico || "—"} · DIČ: {odb.dic || "—"}</div>
                {odb.ic_dph && <div>IČ DPH: {odb.ic_dph}</div>}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <div style={labelSt}>Vystavená</div>
              <input type="date" style={inputSt} value={datumVystavenia} onChange={(e) => setDatumVystavenia(e.target.value)} />
            </div>
            <div>
              <div style={labelSt}>Dodanie</div>
              <input type="date" style={inputSt} value={datumDodania} onChange={(e) => setDatumDodania(e.target.value)} />
            </div>
            <div>
              <div style={labelSt}>Splatnosť</div>
              <input type="date" style={inputSt} value={datumSplatnosti} onChange={(e) => setDatumSplatnosti(e.target.value)} />
            </div>
            <div>
              <div style={labelSt}>Úhrada</div>
              <select style={inputSt} value={formaUhrady} onChange={(e) => setFormaUhrady(e.target.value)}>
                <option>Prevodom</option>
                <option>Hotovosť</option>
                <option>Karta</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>Položky</div>
          <button onClick={addPolozka} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>+ Pridať</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {polozky.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr auto", gap: "8px", alignItems: "center" }}>
              <input style={inputSt} placeholder="Popis položky" value={p.popis} onChange={(e) => updatePolozka(i, { popis: e.target.value })} />
              <input style={inputSt} inputMode="decimal" value={p.mnozstvo} onChange={(e) => updatePolozka(i, { mnozstvo: e.target.value })} />
              <input style={inputSt} value={p.jednotka} onChange={(e) => updatePolozka(i, { jednotka: e.target.value })} />
              <input style={inputSt} inputMode="decimal" placeholder="Cena/j" value={p.cena_jednotka} onChange={(e) => updatePolozka(i, { cena_jednotka: e.target.value })} />
              <div style={{ textAlign: "right", fontWeight: 600, fontSize: "13px" }}>{p.spolu.toFixed(2)} €</div>
              <button onClick={() => removePolozka(i)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", color: "var(--danger)" }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "20px", alignItems: "center" }}>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 600 }}>Spolu</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#374151" }}>{sumaCelkom.toFixed(2)} €</div>
        </div>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
        <div style={labelSt}>Poznámka</div>
        <textarea style={{ ...inputSt, minHeight: "60px", resize: "vertical" }} value={poznamka} onChange={(e) => setPoznamka(e.target.value)} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <button onClick={() => router.back()} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 16px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>Zrušiť</button>
        <button onClick={save} disabled={saving} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", cursor: "pointer", fontSize: "14px", fontWeight: 600, opacity: saving ? 0.5 : 1 }}>
          {saving ? "Ukladám…" : "Vystaviť faktúru"}
        </button>
      </div>
    </div>
  );
}
