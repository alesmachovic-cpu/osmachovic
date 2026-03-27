"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Klient } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import NaberyForm from "@/components/NaberyForm";
import Stepper from "@/components/Stepper";

type TypNaber = "byt" | "rodinny_dom" | "pozemok";

const TYPY = [
  { key: "byt" as TypNaber, icon: "🏢", label: "Byt", desc: "Byty, garsónky, apartmány", color: "#EFF6FF" },
  { key: "rodinny_dom" as TypNaber, icon: "🏡", label: "Rodinný dom", desc: "Domy, chalupy, chaty", color: "#F0FDF4" },
  { key: "pozemok" as TypNaber, icon: "🌿", label: "Pozemok", desc: "Stavebné, poľnohospodárske, lesy", color: "#FFFBEB" },
];

type Step = "klient" | "typ" | "formular" | "hotovo";

const STEPS = [
  { key: "klient", label: "Klient", num: 1 },
  { key: "typ", label: "Typ", num: 2 },
  { key: "formular", label: "Formulár", num: 3 },
  { key: "hotovo", label: "Hotovo", num: 4 },
];

export default function NaberPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}>
      <NaberPageContent />
    </Suspense>
  );
}

function NaberPageContent() {
  const searchParams = useSearchParams();
  const preselectedKlientId = searchParams.get("klient_id");

  const [step, setStep] = useState<Step>("klient");
  const [selectedKlient, setSelectedKlient] = useState<Klient | null>(null);
  const [selectedType, setSelectedType] = useState<TypNaber | null>(null);
  const [submittedAt, setSubmittedAt] = useState("");
  const [savedNaberId, setSavedNaberId] = useState<string | null>(null);
  const [naberDatum, setNaberDatum] = useState("");
  const [showDatumPicker, setShowDatumPicker] = useState(false);
  const [calendarSynced, setCalendarSynced] = useState(false);

  // Klient search
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKlienti();
  }, []);

  async function loadKlienti() {
    setLoading(true);
    const { data } = await supabase
      .from("klienti")
      .select("*")
      .order("created_at", { ascending: false });
    setKlienti(data ?? []);

    // Ak prišiel klient_id z URL, preskočí rovno na typ
    if (preselectedKlientId && data) {
      const found = data.find(k => k.id === preselectedKlientId);
      if (found) {
        setSelectedKlient(found);
        setStep("typ");
      }
    }

    setLoading(false);
  }

  // Výber klienta → zmena statusu na dohodnuty_naber + výber dátumu
  async function handleSelectKlient(k: Klient) {
    setSelectedKlient(k);
    if (k.status !== "dohodnuty_naber" && k.status !== "nabrany") {
      await supabase.from("klienti").update({ status: "dohodnuty_naber" }).eq("id", k.id);
      setKlienti(prev => prev.map(kl => kl.id === k.id ? { ...kl, status: "dohodnuty_naber" as Klient["status"] } : kl));
    }
    setShowDatumPicker(true);
  }

  function handleDatumConfirm() {
    setShowDatumPicker(false);
    setStep("typ");
  }

  // Po uložení náberu → sync do kalendára
  async function handleNaberSubmit(data: { id: string }) {
    setSavedNaberId(data.id);
    setSubmittedAt(new Date().toLocaleString("sk", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }));

    if (selectedKlient) {
      const adresa = [selectedKlient.lokalita].filter(Boolean).join(", ");
      const datum = naberDatum || new Date().toISOString();
      try {
        const { data: naberData } = await supabase
          .from("naberove_listy").select("*").eq("id", data.id).single();

        const naberAdresa = naberData
          ? [naberData.ulica, naberData.cislo_orientacne, naberData.obec, naberData.okres].filter(Boolean).join(", ")
          : adresa;

        await fetch("/api/calendar-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Náber — ${selectedKlient.meno}`,
            datetime: datum,
            description: [
              naberAdresa && `Adresa: ${naberAdresa}`,
              selectedKlient.telefon && `Tel: ${selectedKlient.telefon}`,
              naberData?.typ_nehnutelnosti && `Typ: ${naberData.typ_nehnutelnosti}`,
              naberData?.plocha && `Plocha: ${naberData.plocha} m²`,
              naberData?.predajna_cena && `Cena: ${Number(naberData.predajna_cena).toLocaleString("sk")} €`,
            ].filter(Boolean).join("\n"),
            telefon: selectedKlient.telefon,
          }),
        });
        setCalendarSynced(true);
      } catch { /* kalendár zlyhá ticho */ }
    }

    setStep("hotovo");
  }

  // Filtrovanie — len predávajúci a oboje, dohodnutý náber navrchu
  const filtered = klienti.filter(k => {
    // Len predávajúci alebo oboje — kupujúci nepatria do náberu
    if (k.typ === "kupujuci") return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      k.meno?.toLowerCase().includes(q) ||
      k.telefon?.toLowerCase().includes(q) ||
      k.email?.toLowerCase().includes(q) ||
      k.lokalita?.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const priority: Record<string, number> = {
      dohodnuty_naber: 0,
      novy_kontakt: 1,
      aktivny: 2,
    };
    const pa = priority[a.status] ?? 9;
    const pb = priority[b.status] ?? 9;
    return pa - pb;
  });

  function handleStepClick(targetKey: string) {
    setStep(targetKey as Step);
  }

  function renderStepper() {
    return <Stepper steps={STEPS} currentStep={step} onStepClick={handleStepClick} />;
  }

  // Dátum picker modal
  if (showDatumPicker && selectedKlient) {
    return (
      <div style={{ maxWidth: "720px" }}>
        {renderStepper()}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "20px", padding: "32px", textAlign: "center",
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%", background: "#F5F3FF",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px", margin: "0 auto 16px", border: "2px solid #DDD6FE",
          }}>📅</div>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
            Kedy bude náber?
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
            Zvol dátum a čas pre <strong style={{ color: "var(--text-primary)" }}>{selectedKlient.meno}</strong>
          </p>
          <input
            type="datetime-local"
            value={naberDatum ? naberDatum.slice(0, 16) : ""}
            onChange={e => setNaberDatum(e.target.value ? new Date(e.target.value).toISOString() : "")}
            style={{
              width: "100%", maxWidth: "300px", padding: "14px 16px",
              background: "var(--bg-elevated)", border: "2px solid var(--border)",
              borderRadius: "12px", fontSize: "15px", color: "var(--text-primary)",
              outline: "none", textAlign: "center",
            }}
          />
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "24px" }}>
            <button onClick={() => { setShowDatumPicker(false); setSelectedKlient(null); }} style={{
              padding: "10px 24px", background: "var(--bg-elevated)",
              color: "var(--text-secondary)", border: "1px solid var(--border)",
              borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>
              ← Späť
            </button>
            <button onClick={handleDatumConfirm} style={{
              padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>
              {naberDatum ? "Pokračovať →" : "Bez dátumu →"}
            </button>
          </div>
          {selectedKlient.telefon && (
            <div style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
              📱 {selectedKlient.telefon}
              {selectedKlient.lokalita && <span> · 📍 {selectedKlient.lokalita}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // KROK 1: Výber klienta
  if (step === "klient") {
    const dohodnuti = filtered.filter(k => k.status === "dohodnuty_naber");
    const ostatni = filtered.filter(k => k.status !== "dohodnuty_naber");

    return (
      <div style={{ maxWidth: "720px" }}>
        {renderStepper()}

        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
            Vyber klienta
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            Zvol klienta pre nový náberový list
          </p>
        </div>

        {/* Vyhľadávanie */}
        <div style={{ position: "relative", marginBottom: "20px" }}>
          <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "15px", color: "var(--text-muted)", pointerEvents: "none" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Hľadaj meno, telefón, lokalitu..."
            style={{
              width: "100%", padding: "12px 16px 12px 40px", background: "var(--bg-surface)",
              border: "1px solid var(--border)", borderRadius: "12px", fontSize: "14px",
              color: "var(--text-primary)", outline: "none",
            }} />
        </div>

        {loading && <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}

        {/* Dohodnutí klienti — prioritní */}
        {!loading && dohodnuti.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{
              fontSize: "11px", fontWeight: "700", color: "#374151", marginBottom: "10px",
              textTransform: "uppercase", letterSpacing: "0.05em",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%", background: "#374151",
              }} />
              Čakajú na náber ({dohodnuti.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }} className="naber-grid">
              {dohodnuti.map(k => {
                const initials = k.meno.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <button key={k.id} onClick={() => handleSelectKlient(k)} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "16px", background: "var(--bg-surface)",
                    border: "2px solid #374151",
                    borderRadius: "14px", cursor: "pointer", textAlign: "left", width: "100%",
                    transition: "transform 0.1s, box-shadow 0.1s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "50%",
                      background: "#374151", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", fontWeight: "700", flexShrink: 0,
                    }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>{k.meno}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {k.telefon || "—"}
                      </div>
                      {k.lokalita && (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                          📍 {k.lokalita}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: "10px", fontWeight: "700", color: "#374151", background: "#F3F4F6",
                      padding: "4px 10px", borderRadius: "10px", whiteSpace: "nowrap",
                    }}>Dohodnutý</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ostatní klienti */}
        {!loading && ostatni.length > 0 && (
          <div>
            {dohodnuti.length > 0 && (
              <div style={{
                fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "10px",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                Všetci klienti
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {ostatni.slice(0, 20).map(k => {
                const initials = k.meno.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <button key={k.id} onClick={() => handleSelectKlient(k)} style={{
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
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            padding: "60px", textAlign: "center", color: "var(--text-muted)",
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px",
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>👥</div>
            <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>Žiadny klient nenájdený</div>
            <div style={{ fontSize: "12px" }}>Skús zmeniť hľadaný výraz</div>
          </div>
        )}
      </div>
    );
  }

  // KROK 2: Výber typu nehnuteľnosti
  if (step === "typ") {
    return (
      <div style={{ maxWidth: "720px" }}>
        {renderStepper()}

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
          <button onClick={() => setStep("klient")} style={{
            width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--border)",
            background: "var(--bg-surface)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0, color: "var(--text-primary)" }}>
              Typ nehnuteľnosti
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Náber pre <strong style={{ color: "var(--text-primary)" }}>{selectedKlient?.meno}</strong>
              {selectedKlient?.telefon && <span> · {selectedKlient.telefon}</span>}
            </p>
          </div>
        </div>

        {/* Klient karta */}
        <div style={{
          display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px",
          background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px",
          marginBottom: "20px",
        }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: "#374151", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: "700", flexShrink: 0,
          }}>
            {selectedKlient?.meno.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>{selectedKlient?.meno}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {[selectedKlient?.telefon, selectedKlient?.email, selectedKlient?.lokalita].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        </div>

        {/* Typ karty — grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }} className="naber-grid">
          {TYPY.map(t => (
            <button key={t.key} onClick={() => { setSelectedType(t.key); setStep("formular"); }} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
              padding: "28px 20px", background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "16px", cursor: "pointer", textAlign: "center",
              transition: "border-color 0.15s, transform 0.1s, box-shadow 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{
                width: "64px", height: "64px", borderRadius: "18px", background: t.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "32px",
              }}>{t.icon}</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>{t.label}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.3" }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // KROK 3: Formulár
  if (step === "formular" && selectedType && selectedKlient) {
    return (
      <div>
        <div style={{ maxWidth: "720px" }}>
          {renderStepper()}
        </div>
        <NaberyForm
          typ={selectedType}
          klient={selectedKlient}
          onBack={() => setStep("typ")}
          onSubmit={handleNaberSubmit}
        />
      </div>
    );
  }

  // KROK 4: Potvrdenie
  return (
    <div style={{ maxWidth: "720px" }}>
      {renderStepper()}
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
          Náberový list uložený
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 4px" }}>
          Klient <strong style={{ color: "var(--text-primary)" }}>{selectedKlient?.meno}</strong> bol presunutý do statusu „Nabraný".
        </p>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 12px" }}>
          {submittedAt}
        </p>

        {/* Kalendár info */}
        {naberDatum && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
            background: calendarSynced ? "#ECFDF5" : "#FEF3C7",
            color: calendarSynced ? "#059669" : "#D97706",
            border: `1px solid ${calendarSynced ? "#BBF7D0" : "#FDE68A"}`,
            marginBottom: "24px",
          }}>
            {calendarSynced ? "✓ V kalendári" : "⏳ Čaká na sync"} — {new Date(naberDatum).toLocaleString("sk", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => {
            setStep("klient");
            setSelectedKlient(null);
            setSelectedType(null);
            setNaberDatum("");
            setCalendarSynced(false);
            loadKlienti();
          }} style={{
            padding: "12px 28px", background: "var(--bg-surface)", color: "var(--text-primary)",
            border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
            fontWeight: "600", cursor: "pointer",
          }}>
            Nový náber
          </button>
          <button onClick={() => {
            window.location.href = selectedKlient ? `/inzerat?klient_id=${selectedKlient.id}` : "/inzerat";
          }} style={{
            padding: "12px 28px", background: "#374151", color: "#fff", border: "none",
            borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
          }}>
            Vytvoriť inzerát →
          </button>
          {selectedKlient && (
            <button onClick={() => {
              window.location.href = `/klienti/${selectedKlient.id}`;
            }} style={{
              padding: "12px 28px", background: "var(--bg-surface)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
              fontWeight: "600", cursor: "pointer",
            }}>
              Karta klienta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
