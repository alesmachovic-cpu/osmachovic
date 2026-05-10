"use client";

import { useRouter } from "next/navigation";

type Props = {
  klientTyp: string;
  klientId: string;
  predajnaCena?: number | null;
  cenaDo?: number | null;
  cenaOd?: number | null;
};

const fmt = (n: number) => Math.round(n).toLocaleString("sk");

function calcSplatka(istina: number, rocnyUrok: number, roky: number): number {
  if (!istina || !roky) return 0;
  if (!rocnyUrok) return istina / (roky * 12);
  const r = rocnyUrok / 100 / 12;
  const n = roky * 12;
  return (istina * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function SellerCalc({ cena, klientId }: { cena: number; klientId: string }) {
  const proviziaHruba = cena * 0.03;
  const proviziaC = proviziaHruba * 0.8;

  return (
    <div style={{ padding: "10px 14px" }}>
      <Row label="Predajná cena" value={`${fmt(cena)} €`} />
      <Row label="Provízia 3 %" value={`${fmt(proviziaHruba)} €`} />
      <Row label="Čistá (× 0,8)" value={`${fmt(proviziaC)} €`} />
      <a href={`/klienti/${klientId}?tab=nehnutelnosti`}
        style={{ display: "block", marginTop: "8px", fontSize: "11px", color: "#60a5fa", textDecoration: "none", textAlign: "right" }}>
        Detail kalkulačky →
      </a>
    </div>
  );
}

function BuyerCalc({ cenaDo, cenaOd, klientId }: { cenaDo: number; cenaOd?: number | null; klientId: string }) {
  const ltv = 0.8;
  const splatka = calcSplatka(cenaDo * ltv, 4.5, 30);
  const vlastneDo = Math.round(cenaDo * (1 - ltv));
  const vlastneOd = cenaOd ? Math.round(cenaOd * (1 - ltv)) : null;
  const rozpocet = cenaOd ? `${fmt(cenaOd)} – ${fmt(cenaDo)} €` : `max. ${fmt(cenaDo)} €`;
  const vlastneStr = vlastneOd ? `${fmt(vlastneOd)} – ${fmt(vlastneDo)} €` : `${fmt(vlastneDo)} €`;

  return (
    <div style={{ padding: "10px 14px" }}>
      <Row label="Rozpočet" value={rozpocet} />
      <Row label="Splátka (~80 % LTV)" value={`~${fmt(splatka)} €/mes`} />
      <Row label="Vlastné zdroje (20 %)" value={vlastneStr} />
      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
        * orientačne · 4,5 % p.a. · 30 rokov
      </div>
      <a href={`/nastroje?tab=kalkulator&cena=${cenaDo}${cenaOd ? `&cenaOd=${cenaOd}` : ""}`}
        style={{ display: "block", marginTop: "6px", fontSize: "11px", color: "#60a5fa", textDecoration: "none", textAlign: "right" }}>
        Plná kalkulačka →
      </a>
    </div>
  );
}

export function CalculatorWidget({ klientTyp, klientId, predajnaCena, cenaDo, cenaOd }: Props) {
  const router = useRouter();
  const isSeller = klientTyp === "predavajuci" || klientTyp === "oboje";
  const isBuyer = klientTyp === "kupujuci" || klientTyp === "oboje";

  const hasSeller = isSeller && !!predajnaCena;
  const hasBuyer = isBuyer && !!cenaDo;

  return (
    <div>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>💰 Kalkulačka</span>
      </div>

      {hasSeller && <SellerCalc cena={predajnaCena!} klientId={klientId} />}

      {!hasSeller && isSeller && (
        <div style={{ padding: "14px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
          Chýba predajná cena.
          <button onClick={() => router.push(`/naber?klient_id=${klientId}`)}
            style={{ display: "block", margin: "6px auto 0", fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>
            Vytvoriť náberový list →
          </button>
        </div>
      )}

      {hasBuyer && <BuyerCalc cenaDo={cenaDo!} cenaOd={cenaOd} klientId={klientId} />}

      {!hasBuyer && isBuyer && (
        <div style={{ padding: "14px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
          Chýba objednávka s cenou.
          <button onClick={() => router.push(`/kupujuci?klient_id=${klientId}`)}
            style={{ display: "block", margin: "6px auto 0", fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>
            Vytvoriť objednávku →
          </button>
        </div>
      )}
    </div>
  );
}
