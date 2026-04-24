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
      const r = await supabase.from("nehnutelnosti").select("*").eq("id", editId).single();
      if (r.data) setNaberData(r.data);
      setHasNaber(true);
      setChecking(false);
      return;
    }

    // Ak nemá klient_id, zobraz formulár priamo (backward compatible)
    if (!klientId) {
      setChecking(false);
      setHasNaber(true);
      return;
    }

    // Over či klient má náber
    const [naberRes, klientRes] = await Promise.all([
      supabase.from("naberove_listy").select("*").eq("klient_id", klientId).order("created_at", { ascending: false }).limit(1),
      supabase.from("klienti").select("meno, typ_transakcie").eq("id", klientId).single(),
    ]);

    if (klientRes.data) setKlientName(klientRes.data.meno);

    if (naberRes.data && naberRes.data.length > 0) {
      // Zapoj klient.typ_transakcie do prefillu — InzeratForm ho použije ako default kategoria
      const klientTypTrans = (klientRes.data as unknown as { typ_transakcie?: string })?.typ_transakcie || null;
      const merged = klientTypTrans
        ? { ...naberRes.data[0], _klient_typ_transakcie: klientTypTrans }
        : naberRes.data[0];
      setHasNaber(true);
      setNaberData(merged);
    }
    setChecking(false);
  }

  if (checking) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Overujem pipeline...</div>;
  }

  // Ak klient nemá náber — zobraz upozornenie
  if (klientId && !hasNaber) {
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
            Najprv vyplň náberový list
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 8px" }}>
            {klientName ? (
              <>Klient <strong style={{ color: "var(--text-primary)" }}>{klientName}</strong> nemá vyplnený náberový list.</>
            ) : (
              <>Tento klient nemá vyplnený náberový list.</>
            )}
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 32px" }}>
            Pre vytvorenie inzerátu musí byť najprv vyplnený náberový list s údajmi o nehnuteľnosti.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push(`/naber?klient_id=${klientId}`)} style={{
              padding: "12px 28px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
            }}>
              📝 Vyplniť náber →
            </button>
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
