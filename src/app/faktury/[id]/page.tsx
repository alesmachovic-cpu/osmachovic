"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { loadDodavatel, DEFAULT_DODAVATEL, type DodavatelSettings } from "@/app/nastavenia/faktury/page";
import { useAuth } from "@/components/AuthProvider";

type Polozka = { id: string; popis: string; mnozstvo: number; jednotka: string; cena_jednotka: number; spolu: number };
type Faktura = {
  id: string;
  cislo_faktury: string;
  variabilny_symbol: string;
  datum_vystavenia: string;
  datum_dodania: string | null;
  datum_splatnosti: string | null;
  forma_uhrady: string;
  suma_celkom: number;
  zaplatene: boolean;
  poznamka: string | null;
  odberatel_snapshot: { nazov?: string; adresa?: string; ico?: string; dic?: string; ic_dph?: string } | null;
  polozky: Polozka[];
};

export default function FakturaDetail() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [f, setF] = useState<Faktura | null>(null);
  const [DODAVATEL, setDodavatel] = useState<DodavatelSettings>(DEFAULT_DODAVATEL);

  useEffect(() => {
    fetch(`/api/faktury?id=${params.id}`).then((r) => r.json()).then(setF);
    setDodavatel(loadDodavatel(user?.id));
  }, [params.id, user?.id]);

  if (!f) return <div style={{ padding: "24px" }}>Načítavam…</div>;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <Link href="/faktury" style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "none" }}>← Späť na faktúry</Link>
        <button onClick={() => window.print()} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
          🖨️ Tlačiť / PDF
        </button>
      </div>

      <div id="faktura-print" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "14px", padding: "40px", color: "#1d1d1f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#86868b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Faktúra</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#374151", marginTop: "4px" }}>{f.cislo_faktury}</div>
            <div style={{ fontSize: "12px", color: "#86868b", marginTop: "2px" }}>VS: {f.variabilny_symbol}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: "12px", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, fontSize: "14px" }}>{DODAVATEL.nazov}</div>
            <div>{DODAVATEL.adresa}</div>
            <div>IČO: {DODAVATEL.ico}</div>
            <div>DIČ: {DODAVATEL.dic}</div>
            {DODAVATEL.ic_dph && <div>IČ DPH: {DODAVATEL.ic_dph}</div>}
            {DODAVATEL.obch_register && <div style={{ marginTop: "4px", fontSize: "11px", color: "#86868b" }}>{DODAVATEL.obch_register}</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#86868b", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>Odberateľ</div>
            <div style={{ fontSize: "14px", fontWeight: 700 }}>{f.odberatel_snapshot?.nazov}</div>
            <div style={{ fontSize: "12px", lineHeight: 1.6, color: "#3a3a3c" }}>
              <div>{f.odberatel_snapshot?.adresa}</div>
              <div>IČO: {f.odberatel_snapshot?.ico || "—"}</div>
              <div>DIČ: {f.odberatel_snapshot?.dic || "—"}</div>
              {f.odberatel_snapshot?.ic_dph && <div>IČ DPH: {f.odberatel_snapshot.ic_dph}</div>}
            </div>
          </div>
          <div style={{ fontSize: "12px", lineHeight: 1.8 }}>
            <Row k="Dátum vystavenia" v={f.datum_vystavenia} />
            <Row k="Dátum dodania" v={f.datum_dodania || "—"} />
            <Row k="Dátum splatnosti" v={f.datum_splatnosti || "—"} />
            <Row k="Forma úhrady" v={f.forma_uhrady} />
            <Row k="Variabilný symbol" v={f.variabilny_symbol} />
            {DODAVATEL.konst_symbol && <Row k="Konšt. symbol" v={DODAVATEL.konst_symbol} />}
            {DODAVATEL.iban && <Row k="IBAN" v={DODAVATEL.iban} />}
            {DODAVATEL.banka && <Row k="Banka" v={DODAVATEL.banka} />}
            {DODAVATEL.swift && <Row k="SWIFT" v={DODAVATEL.swift} />}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "24px" }}>
          <thead>
            <tr style={{ background: "#f5f5f7" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "#86868b" }}>Popis</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "#86868b" }}>Množstvo</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "#86868b" }}>Cena/j</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "#86868b" }}>Spolu</th>
            </tr>
          </thead>
          <tbody>
            {f.polozky.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f5" }}>
                <td style={{ padding: "12px" }}>{p.popis}</td>
                <td style={{ padding: "12px", textAlign: "right" }}>{p.mnozstvo} {p.jednotka}</td>
                <td style={{ padding: "12px", textAlign: "right" }}>{Number(p.cena_jednotka).toFixed(2)} €</td>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>{Number(p.spolu).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
          <div style={{ width: "260px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "2px solid #374151", fontSize: "16px", fontWeight: 700 }}>
              <div>Celkom k úhrade</div>
              <div>{Number(f.suma_celkom).toFixed(2)} €</div>
            </div>
          </div>
        </div>

        {DODAVATEL.vystavil && (
          <div style={{ fontSize: "12px", color: "#3a3a3c", marginTop: "20px", lineHeight: 1.6 }}>
            <div style={{ color: "#86868b", fontWeight: 700 }}>Vystavil:</div>
            <div>{DODAVATEL.vystavil}</div>
            {DODAVATEL.telefon && <div>Mobil: {DODAVATEL.telefon}</div>}
          </div>
        )}

        {f.poznamka && (
          <div style={{ fontSize: "12px", color: "#3a3a3c", paddingTop: "16px", borderTop: "1px solid #f0f0f5" }}>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>Poznámka</div>
            <div>{f.poznamka}</div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print, aside, nav, header { display: none !important; }
          body, html { background: #fff !important; }
          #faktura-print { border: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
      <div style={{ color: "#86868b" }}>{k}</div>
      <div style={{ fontWeight: 600 }}>{v}</div>
    </div>
  );
}
