"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import InzeratForm from "@/components/InzeratForm";

export default function InzeratPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}>
      <InzeratPageContent />
    </Suspense>
  );
}

function InzeratPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const klientId = searchParams.get("klient_id");
  const editId = searchParams.get("id");

  const [checking, setChecking] = useState(true);
  const [hasNaber, setHasNaber] = useState(false);
  const [naberData, setNaberData] = useState<Record<string, unknown> | null>(null);
  const [klientName, setKlientName] = useState("");

  useEffect(() => {
    checkPipeline();
  }, []);

  async function checkPipeline() {
    // Edit mode — načítaj existujúci inzerát z nehnutelnosti
    if (editId) {
      const r = await fetch(`/api/nehnutelnosti?id=${editId}`).then(res => res.json());
      if (r.nehnutelnost) setNaberData(r.nehnutelnost);
      setHasNaber(true);
      setChecking(false);
      return;
    }

    // Bez klient_id a bez editId → nemôže sa vytvoriť inzerát "nanovo". Inzerát
    // sa vytvorí iba z karty klienta po vyplnení podpísaného náberového listu.
    if (!klientId) {
      setChecking(false);
      setHasNaber(false);
      return;
    }

    // Over či klient má náber
    const [naberArr, klientJson] = await Promise.all([
      fetch(`/api/nabery?klient_id=${klientId}`).then(r => r.json()),
      fetch(`/api/klienti?id=${klientId}`).then(r => r.json()),
    ]);
    const nabery = Array.isArray(naberArr) ? naberArr : [];
    const klientData = klientJson?.klient ?? null;

    if (klientData) setKlientName(klientData.meno);

    if (nabery.length > 0) {
      // Zapoj klient.typ do prefillu — InzeratForm ho použije ako default kategoria:
      //   - "predavajuci" / "oboje" → na-predaj
      //   - "prenajimatel" → na-najom
      const klientTyp = klientData?.typ || null;
      const derivedKategoria = klientTyp === "prenajimatel" ? "na-prenajom"
        : (klientTyp === "predavajuci" || klientTyp === "oboje") ? "na-predaj"
        : null;
      const merged = derivedKategoria
        ? { ...nabery[0], _klient_typ_transakcie: derivedKategoria }
        : nabery[0];
      setHasNaber(true);
      setNaberData(merged);
    }
    setChecking(false);
  }

  if (checking) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Overujem pipeline...</div>;
  }

  // Ak nie je náber (bez klient_id = priamy vstup na /inzerat, alebo klient bez náberu)
  // — inzerát sa nedá vytvoriť. Inzerát sa tvorí iba z karty klienta po náberáku.
  if (!hasNaber) {
    return (
      <div style={{ maxWidth: "600px" }}>
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "20px",
          padding: "48px 32px", textAlign: "center",
        }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%", background: "#FEF3C7",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "36px", margin: "0 auto 24px", border: "3px solid #FDE68A",
          }}>📝</div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px" }}>
            {klientId ? "Najprv vyplň náberový list" : "Inzerát sa vytvára z karty klienta"}
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 8px" }}>
            {klientId ? (
              klientName
                ? <>Klient <strong style={{ color: "var(--text-primary)" }}>{klientName}</strong> nemá vyplnený náberový list.</>
                : <>Tento klient nemá vyplnený náberový list.</>
            ) : (
              <>Nový inzerát sa nedá vytvoriť priamo. Otvor kartu klienta a vyplň náberový list — potom sa ti v <em>Pipeline predávajúceho</em> sprístupní tlačidlo „Vytvoriť inzerát".</>
            )}
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 32px" }}>
            Každý inzerát musí vychádzať z podpísaného náberáka — kvôli auditu, legalite a presnej evidencii.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            {klientId ? (
              <button onClick={() => router.push(`/naber?klient_id=${klientId}`)} style={{
                padding: "12px 28px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              }}>📝 Vyplniť náber →</button>
            ) : (
              <button onClick={() => router.push("/klienti")} style={{
                padding: "12px 28px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              }}>👥 Otvoriť klientov</button>
            )}
            <button onClick={() => router.back()} style={{
              padding: "12px 28px", background: "var(--bg-surface)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
              fontWeight: "600", cursor: "pointer",
            }}>
              ← Späť
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ak má náber alebo nie je klient — zobraz formulár
  return <InzeratForm prefilledData={naberData} editId={editId || undefined} onSaved={() => router.push("/portfolio")} onCancel={() => router.push("/portfolio")} />;
}
