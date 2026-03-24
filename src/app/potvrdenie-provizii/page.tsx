"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface RezervovanaNehnutelnost {
  id: string;
  nazov: string;
  lokalita: string;
  cena: number;
  provizia_hodnota: number | null;
  provizia_typ: string;
  makler: string | null;
  klient_meno?: string;
}

interface PotvrdenieProvizie {
  nehnutelnostId: string;
  stav: "potvrdena" | "odmietnuta";
  datum: string;
  poznamka?: string;
}

const LS_KEY = "os_machovic_potvrdenie_provizii";

export default function PotvrdenieProviziiPage() {
  const [nehnutelnosti, setNehnutelnosti] = useState<RezervovanaNehnutelnost[]>([]);
  const [potvrdenia, setPotvrdenia] = useState<PotvrdenieProvizie[]>([]);
  const [loading, setLoading] = useState(true);
  const [poznamkaId, setPoznamkaId] = useState<string | null>(null);
  const [poznamka, setPoznamka] = useState("");

  useEffect(() => {
    const data = localStorage.getItem(LS_KEY);
    if (data) setPotvrdenia(JSON.parse(data));
    fetchRezervovane();
  }, []);

  const fetchRezervovane = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("nehnutelnosti")
      .select("id, nazov, lokalita, cena, provizia_hodnota, provizia_typ, makler")
      .eq("stav", "rezervovane");

    if (!error && data) {
      setNehnutelnosti(data);
    }
    setLoading(false);
  };

  const savePotvrdenia = (items: PotvrdenieProvizie[]) => {
    setPotvrdenia(items);
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  };

  const potvrdit = (nehnutelnostId: string) => {
    const existing = potvrdenia.filter((p) => p.nehnutelnostId !== nehnutelnostId);
    savePotvrdenia([
      ...existing,
      {
        nehnutelnostId,
        stav: "potvrdena",
        datum: new Date().toISOString(),
        poznamka: poznamkaId === nehnutelnostId ? poznamka.trim() || undefined : undefined,
      },
    ]);
    setPoznamkaId(null);
    setPoznamka("");
  };

  const odmietnut = (nehnutelnostId: string) => {
    const existing = potvrdenia.filter((p) => p.nehnutelnostId !== nehnutelnostId);
    savePotvrdenia([
      ...existing,
      {
        nehnutelnostId,
        stav: "odmietnuta",
        datum: new Date().toISOString(),
        poznamka: poznamkaId === nehnutelnostId ? poznamka.trim() || undefined : undefined,
      },
    ]);
    setPoznamkaId(null);
    setPoznamka("");
  };

  const resetovat = (nehnutelnostId: string) => {
    savePotvrdenia(potvrdenia.filter((p) => p.nehnutelnostId !== nehnutelnostId));
  };

  const getPotvrdenie = (id: string) => potvrdenia.find((p) => p.nehnutelnostId === id);

  const potvrdene = nehnutelnosti.filter((n) => getPotvrdenie(n.id)?.stav === "potvrdena");
  const odmietnute = nehnutelnosti.filter((n) => getPotvrdenie(n.id)?.stav === "odmietnuta");
  const cakajuce = nehnutelnosti.filter((n) => !getPotvrdenie(n.id));

  const formatCena = (cena: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cena);

  const vypocitajProviziu = (n: RezervovanaNehnutelnost): string => {
    if (!n.provizia_hodnota) return "Neuvedená";
    if (n.provizia_typ === "percento" || n.provizia_typ === "%") {
      const suma = (n.cena * n.provizia_hodnota) / 100;
      return `${n.provizia_hodnota}% = ${formatCena(suma)}`;
    }
    return formatCena(n.provizia_hodnota);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F2F2F7", padding: "24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1C1C1E", margin: 0 }}>
            Potvrdenie provízie
          </h1>
          <p style={{ fontSize: 15, color: "#8E8E93", marginTop: 4 }}>
            Potvrdenie provízií pri rezervovaných nehnuteľnostiach
          </p>
        </div>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>Čakajúce</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#FF9500", margin: "4px 0 0" }}>
              {cakajuce.length}
            </p>
          </div>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>Potvrdené</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#34C759", margin: "4px 0 0" }}>
              {potvrdene.length}
            </p>
          </div>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>Odmietnuté</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#FF3B30", margin: "4px 0 0" }}>
              {odmietnute.length}
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "#8E8E93",
              fontSize: 15,
            }}
          >
            Načítavam rezervované nehnuteľnosti...
          </div>
        )}

        {/* No results */}
        {!loading && nehnutelnosti.length === 0 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 48,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", margin: "0 0 8px" }}>
              Žiadne rezervované nehnuteľnosti
            </p>
            <p style={{ fontSize: 14, color: "#8E8E93", margin: 0 }}>
              Keď sa nehnuteľnosť nastaví do stavu &quot;rezervované&quot;, zobrazí sa tu na potvrdenie provízie.
            </p>
          </div>
        )}

        {/* Pending list */}
        {cakajuce.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", margin: "0 0 12px", padding: "0 4px" }}>
              Na potvrdenie ({cakajuce.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cakajuce.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: 20,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    borderLeft: "4px solid #FF9500",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", margin: 0 }}>
                        {n.nazov}
                      </p>
                      <p style={{ fontSize: 14, color: "#8E8E93", margin: "4px 0" }}>{n.lokalita}</p>
                      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                        <div>
                          <span style={{ fontSize: 12, color: "#AEAEB2" }}>Cena</span>
                          <p style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1E", margin: "2px 0 0" }}>
                            {formatCena(n.cena)}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontSize: 12, color: "#AEAEB2" }}>Provízia</span>
                          <p style={{ fontSize: 16, fontWeight: 600, color: "#007AFF", margin: "2px 0 0" }}>
                            {vypocitajProviziu(n)}
                          </p>
                        </div>
                        {n.makler && (
                          <div>
                            <span style={{ fontSize: 12, color: "#AEAEB2" }}>Maklér</span>
                            <p style={{ fontSize: 14, color: "#636366", margin: "2px 0 0" }}>{n.makler}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Note toggle */}
                  {poznamkaId === n.id && (
                    <div style={{ marginTop: 12 }}>
                      <input
                        value={poznamka}
                        onChange={(e) => setPoznamka(e.target.value)}
                        placeholder="Poznámka k rozhodnutiu..."
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #E5E5EA",
                          fontSize: 14,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button
                      onClick={() => potvrdit(n.id)}
                      style={{
                        background: "#34C759",
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 24px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Potvrdiť províziu
                    </button>
                    <button
                      onClick={() => odmietnut(n.id)}
                      style={{
                        background: "#FF3B30",
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 24px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Odmietnuť
                    </button>
                    <button
                      onClick={() => {
                        if (poznamkaId === n.id) {
                          setPoznamkaId(null);
                          setPoznamka("");
                        } else {
                          setPoznamkaId(n.id);
                          setPoznamka("");
                        }
                      }}
                      style={{
                        background: "#F2F2F7",
                        color: "#636366",
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 16px",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {poznamkaId === n.id ? "Skryť poznámku" : "Pridať poznámku"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmed list */}
        {potvrdene.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", margin: "0 0 12px", padding: "0 4px" }}>
              Potvrdené ({potvrdene.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {potvrdene.map((n) => {
                const p = getPotvrdenie(n.id)!;
                return (
                  <div
                    key={n.id}
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      padding: 16,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      borderLeft: "4px solid #34C759",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E", margin: 0 }}>{n.nazov}</p>
                      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 13, color: "#8E8E93" }}>{n.lokalita}</span>
                        <span style={{ fontSize: 13, color: "#007AFF", fontWeight: 500 }}>
                          {vypocitajProviziu(n)}
                        </span>
                      </div>
                      {p.poznamka && (
                        <p style={{ fontSize: 12, color: "#636366", margin: "4px 0 0", fontStyle: "italic" }}>
                          {p.poznamka}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#AEAEB2" }}>
                        {new Date(p.datum).toLocaleDateString("sk-SK")}
                      </span>
                      <button
                        onClick={() => resetovat(n.id)}
                        style={{
                          background: "#F2F2F7",
                          color: "#8E8E93",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Zrušiť
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rejected list */}
        {odmietnute.length > 0 && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", margin: "0 0 12px", padding: "0 4px" }}>
              Odmietnuté ({odmietnute.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {odmietnute.map((n) => {
                const p = getPotvrdenie(n.id)!;
                return (
                  <div
                    key={n.id}
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      padding: 16,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      borderLeft: "4px solid #FF3B30",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      opacity: 0.7,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E", margin: 0 }}>{n.nazov}</p>
                      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 13, color: "#8E8E93" }}>{n.lokalita}</span>
                        <span style={{ fontSize: 13, color: "#FF3B30", fontWeight: 500 }}>
                          Odmietnutá
                        </span>
                      </div>
                      {p.poznamka && (
                        <p style={{ fontSize: 12, color: "#636366", margin: "4px 0 0", fontStyle: "italic" }}>
                          {p.poznamka}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#AEAEB2" }}>
                        {new Date(p.datum).toLocaleDateString("sk-SK")}
                      </span>
                      <button
                        onClick={() => resetovat(n.id)}
                        style={{
                          background: "#F2F2F7",
                          color: "#8E8E93",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Obnoviť
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
