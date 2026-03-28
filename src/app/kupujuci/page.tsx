"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Klient } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import ObjednavkaForm from "@/components/ObjednavkaForm";
import NewKlientModal from "@/components/NewKlientModal";
import Stepper from "@/components/Stepper";

type Step = "zoznam" | "klient" | "formular" | "hotovo";

const OBJ_STEPS = [
  { key: "klient", label: "Klient", num: 1 },
  { key: "formular", label: "Formulár", num: 2 },
  { key: "hotovo", label: "Hotovo", num: 3 },
];

export default function KupujuciPage() {
  const [step, setStep] = useState<Step>("zoznam");
  const [selectedKlient, setSelectedKlient] = useState<Klient | null>(null);
  const [submittedAt, setSubmittedAt] = useState("");
  const [modal, setModal] = useState(false);
  const [isSimplified, setIsSimplified] = useState(false);

  // Klienti
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [objednavky, setObjednavky] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"objednavky" | "klienti" | "nova">("objednavky");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const klientiRes = await supabase.from("klienti").select("*").order("created_at", { ascending: false });
    setKlienti(klientiRes.data ?? []);
    const objRes = await supabase.from("objednavky").select("*").order("created_at", { ascending: false });
    // Ak tabuľka neexistuje, data bude null
    setObjednavky(objRes.data ?? []);
    setLoading(false);
  }

  // Filtered
  // Len kupujúci a oboje — nie predávajúci
  const kupujuciKlienti = klienti.filter(k => k.typ === "kupujuci" || k.typ === "oboje");

  const filtered = kupujuciKlienti.filter(k => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      k.meno?.toLowerCase().includes(q) ||
      k.telefon?.toLowerCase().includes(q) ||
      k.email?.toLowerCase().includes(q) ||
      k.lokalita?.toLowerCase().includes(q)
    );
  });

  const cardSt: React.CSSProperties = {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "14px", padding: "20px",
  };

  // ZOZNAM — prehľad objednávok + tlačidlo novej
  if (step === "zoznam") {
    // Kupujúci klienti BEZ objednávky
    const objKlientIds = new Set(objednavky.map(o => o.klient_id as string));
    const bezObjednavky = kupujuciKlienti.filter(k => !objKlientIds.has(k.id));

    return (
      <div style={{ maxWidth: "1050px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 3px", color: "var(--text-primary)" }}>Kupujúci</h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              {kupujuciKlienti.length} kupujúcich · {objednavky.length} objednávok
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => { setIsSimplified(true); setTab("nova"); setStep("klient"); }}
              style={{ padding: "9px 18px", background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              + Nový kupujúci
            </button>
            <button onClick={() => { setIsSimplified(false); setTab("nova"); setStep("klient"); }}
              style={{ padding: "9px 18px", background: "#374151", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              + Objednávka
            </button>
          </div>
        </div>

        {/* Taby */}
        <div style={{
          display: "flex", gap: "4px", marginBottom: "20px", padding: "4px",
          background: "var(--bg-elevated)", borderRadius: "12px", border: "1px solid var(--border)",
        }}>
          {[
            { key: "objednavky", label: `Objednávky (${objednavky.length})` },
            { key: "klienti", label: `Klienti (${bezObjednavky.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)} style={{
              flex: 1, padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
              background: tab === t.key ? "var(--bg-surface)" : "transparent",
              border: tab === t.key ? "1px solid var(--border)" : "1px solid transparent",
              fontSize: "13px", fontWeight: tab === t.key ? "700" : "500",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {loading && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}

        {/* TAB: Objednávky */}
        {!loading && tab === "objednavky" && (
          <>
            {objednavky.length === 0 ? (
              <div style={{
                padding: "60px", textAlign: "center", color: "var(--text-muted)",
                background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px",
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
                <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}>Žiadne objednávky</div>
                <div style={{ fontSize: "13px", marginBottom: "20px" }}>Vytvor prvú záväznú objednávku pre kupujúceho klienta</div>
                <button onClick={() => setStep("klient")} style={{
                  padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                  borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
                }}>
                  + Nová objednávka
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
                {objednavky.map((obj: Record<string, unknown>) => {
                  const klient = klienti.find(k => k.id === obj.klient_id);
                  const poziadavky = (obj.poziadavky || {}) as Record<string, unknown>;
                  const lokalita = (obj.lokalita || {}) as Record<string, unknown>;
                  const druhLabel = DRUHY_NEHNUTELNOSTI_MAP[obj.druh as string] || (obj.druh as string);
                  return (
                    <div key={obj.id as string} style={cardSt}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                        <div style={{
                          width: "42px", height: "42px", borderRadius: "50%",
                          background: "#374151", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px", fontWeight: "700", flexShrink: 0,
                        }}>
                          {klient ? klient.meno.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>
                            {klient?.meno || "Neznámy"}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {klient?.telefon || "—"}
                          </div>
                        </div>
                        <span style={{
                          fontSize: "10px", fontWeight: "700", padding: "4px 10px", borderRadius: "10px",
                          background: "#EFF6FF", color: "#1D4ED8",
                        }}>
                          {druhLabel}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px" }}>
                        {lokalita.obec ? (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <span style={{ color: "var(--text-muted)", minWidth: "80px" }}>📍 Lokalita:</span>
                            <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>
                              {[String(lokalita.obec), lokalita.okres ? String(lokalita.okres) : null].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        ) : null}
                        {poziadavky.pocet_izieb ? (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <span style={{ color: "var(--text-muted)", minWidth: "80px" }}>🛏️ Izby:</span>
                            <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>{String(poziadavky.pocet_izieb)}</span>
                          </div>
                        ) : null}
                        {obj.cena_do ? (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <span style={{ color: "var(--text-muted)", minWidth: "80px" }}>💰 Max cena:</span>
                            <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>
                              {Number(obj.cena_do).toLocaleString("sk")} €
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border)",
                      }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {new Date(obj.created_at as string).toLocaleDateString("sk")}
                        </span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {klient && (
                            <button onClick={() => window.location.href = `/klienti/${klient.id}`} style={{
                              padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                              background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer",
                            }}>
                              Karta klienta
                            </button>
                          )}
                          <button onClick={() => window.location.href = "/matching"} style={{
                            padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                            background: "#F3F4F6", color: "#374151", border: "none", cursor: "pointer",
                          }}>
                            Hľadať zhody →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB: Klienti bez objednávky */}
        {!loading && tab === "klienti" && (
          <>
            {bezObjednavky.length === 0 ? (
              <div style={{
                padding: "60px", textAlign: "center", color: "var(--text-muted)",
                background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px",
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>👥</div>
                <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}>Všetci kupujúci majú objednávku</div>
                <div style={{ fontSize: "13px" }}>Pridaj nového kupujúceho klienta</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {bezObjednavky.map(k => {
                  const initials = k.meno.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <div key={k.id} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "14px 16px", background: "var(--bg-surface)",
                      border: "1px solid var(--border)", borderRadius: "12px",
                      cursor: "pointer", transition: "border-color 0.15s",
                    }}
                      onClick={() => window.location.href = `/klienti/${k.id}`}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#374151"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "50%",
                        background: "#E5E7EB", color: "#374151",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "13px", fontWeight: "700", flexShrink: 0,
                      }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{k.meno}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {[k.telefon, k.lokalita].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{
                          fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", background: "#F3F4F6",
                          padding: "3px 8px", borderRadius: "8px",
                        }}>{STATUS_LABELS[k.status] || k.status}</span>
                        <button onClick={e => {
                          e.stopPropagation();
                          setSelectedKlient(k);
                          setStep("formular");
                        }} style={{
                          padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700",
                          background: "#374151", color: "#fff", border: "none", cursor: "pointer",
                        }}>
                          Objednávka →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {modal && <NewKlientModal open defaultTyp="kupujuci" showTypKlienta onClose={() => setModal(false)} onSaved={() => { loadData(); setModal(false); }} />}
      </div>
    );
  }

  // VÝBER KLIENTA
  if (step === "klient") {
    return (
      <div style={{ maxWidth: "720px" }}>
        <Stepper steps={OBJ_STEPS} currentStep="klient" onStepClick={k => setStep(k as Step)} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button onClick={() => setStep("zoznam")} style={{
            width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--border)",
            background: "var(--bg-surface)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
              Vyber kupujúceho
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Zvol klienta pre novú záväznú objednávku
            </p>
          </div>
        </div>

        {/* Search + nový klient */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "15px", color: "var(--text-muted)", pointerEvents: "none" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Hľadaj meno, telefón..."
              style={{
                width: "100%", padding: "12px 16px 12px 40px", background: "var(--bg-surface)",
                border: "1px solid var(--border)", borderRadius: "12px", fontSize: "14px",
                color: "var(--text-primary)", outline: "none",
              }} />
          </div>
          <button onClick={() => setModal(true)} style={{
            padding: "0 16px", background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "12px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            color: "var(--text-primary)", whiteSpace: "nowrap",
          }}>
            + Nový
          </button>
        </div>

        {loading && <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {filtered.slice(0, 25).map(k => {
            const initials = k.meno.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button key={k.id} onClick={() => { setSelectedKlient(k); setStep("formular"); }} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 16px", background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px", cursor: "pointer", textAlign: "left", width: "100%",
                transition: "border-color 0.15s, background 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.background = "var(--bg-elevated)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-surface)"; }}
              >
                <div style={{
                  width: "38px", height: "38px", borderRadius: "50%",
                  background: "#E5E7EB", color: "#374151",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: "700", flexShrink: 0,
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{k.meno}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {[k.telefon, k.lokalita].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <span style={{
                  fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", background: "#F3F4F6",
                  padding: "3px 8px", borderRadius: "8px",
                }}>{STATUS_LABELS[k.status] || k.status}</span>
                <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>→</span>
              </button>
            );
          })}
        </div>

        {!loading && filtered.length === 0 && (
          <div style={{
            padding: "60px", textAlign: "center", color: "var(--text-muted)",
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px",
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>👥</div>
            <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>Žiadny klient nenájdený</div>
            <div style={{ fontSize: "12px", marginBottom: "16px" }}>Skús zmeniť hľadaný výraz alebo vytvor nového</div>
            <button onClick={() => setModal(true)} style={{
              padding: "8px 20px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>+ Nový klient</button>
          </div>
        )}

        {modal && <NewKlientModal open onClose={() => setModal(false)} onSaved={() => { loadData(); setModal(false); }} />}
      </div>
    );
  }

  // FORMULÁR
  if (step === "formular" && selectedKlient) {
    return (
      <div>
        <div style={{ maxWidth: "720px" }}>
          <Stepper steps={OBJ_STEPS} currentStep="formular" onStepClick={k => setStep(k as Step)} />
        </div>
        <ObjednavkaForm
          klient={selectedKlient}
          simplified={isSimplified}
          onBack={() => setStep("klient")}
          onSubmit={(data) => {
            setSubmittedAt(new Date().toLocaleString("sk", {
              day: "numeric", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            }));
            setStep("hotovo");
          }}
        />
      </div>
    );
  }

  // HOTOVO
  return (
    <div style={{ maxWidth: "720px" }}>
      <Stepper steps={OBJ_STEPS} currentStep="hotovo" onStepClick={k => setStep(k as Step)} />
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "20px",
        padding: "48px 32px", textAlign: "center",
      }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%", background: "#F0FDF4",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "36px", margin: "0 auto 24px", border: "3px solid #BBF7D0",
        }}>✓</div>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px" }}>
          Objednávka uložená
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 4px" }}>
          Záväzná objednávka pre <strong style={{ color: "var(--text-primary)" }}>{selectedKlient?.meno}</strong> bola vytvorená.
        </p>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 8px" }}>
          {submittedAt}
        </p>
        <p style={{ fontSize: "13px", color: "#059669", margin: "0 0 36px" }}>
          Systém bude automaticky hľadať zhody s ponukami
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => {
            setStep("zoznam");
            setSelectedKlient(null);
            loadData();
          }} style={{
            padding: "12px 28px", background: "var(--bg-surface)", color: "var(--text-primary)",
            border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
            fontWeight: "600", cursor: "pointer",
          }}>
            Prehľad objednávok
          </button>
          <button onClick={() => {
            setStep("klient");
            setSelectedKlient(null);
            loadData();
          }} style={{
            padding: "12px 28px", background: "#374151", color: "#fff", border: "none",
            borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
          }}>
            Nová objednávka →
          </button>
        </div>
      </div>
    </div>
  );
}

const DRUHY_NEHNUTELNOSTI_MAP: Record<string, string> = {
  byt: "Byt",
  rodinny_dom: "Rodinný dom",
  pozemok: "Pozemok",
  komercne: "Komerčný",
  ine: "Iné",
};
