"use client";

import { useState } from "react";
import FotoVideoForm from "./FotoVideoForm";
import { STAV_COLORS } from "@/lib/produkcia/mapping";

interface KlientData {
  id: string;
  meno: string;
  telefon?: string | null;
  lokalita?: string | null;
  typ_nehnutelnosti?: string | null;
}

interface MaklerData {
  id: string;
  name: string;
}

interface Props {
  klient: KlientData;
  makler: MaklerData;
  onClose: () => void;
  onCreated: () => void;
}

type OrderType = "foto_video" | "homestaging" | "certifikat";

const ORDER_TYPES: { value: OrderType; label: string; icon: string; available: boolean }[] = [
  { value: "foto_video",   label: "Foto-video produkcia", icon: "📸", available: true },
  { value: "homestaging",  label: "Homestaging",          icon: "🏠", available: false },
  { value: "certifikat",   label: "Certifikát",           icon: "📄", available: false },
];

export default function NovaObjednavkaModal({ klient, makler, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<OrderType>("foto_video");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(details: Record<string, unknown>, submit: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/produkcia-objednavky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klient_id: klient.id, typ: selectedType, details }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Chyba"); return; }

      if (submit) {
        const submitRes = await fetch(`/api/produkcia-objednavky/${data.id}/submit`, {
          method: "POST",
        });
        if (!submitRes.ok) {
          const sd = await submitRes.json();
          setError(sd.error || "Chyba pri odoslaní");
          return;
        }
      }

      onCreated();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 1000, padding: "0",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--bg-surface)", borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: "600px",
          maxHeight: "92vh", overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div style={{
          position: "sticky", top: 0, background: "var(--bg-surface)",
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--border)", zIndex: 1,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              {step === 1 ? "Nová objednávka" : "Foto-video produkcia"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
              {klient.meno} · {klient.lokalita ?? "—"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px", height: "32px", borderRadius: "50%",
              border: "none", background: "var(--bg-elevated)",
              color: "var(--text-muted)", cursor: "pointer", fontSize: "18px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>

        <div style={{ padding: "20px" }}>
          {/* Krok 1 — výber typu */}
          {step === 1 && (
            <>
              <div style={{
                display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px",
              }}>
                {ORDER_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => t.available && setSelectedType(t.value)}
                    style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      padding: "16px", borderRadius: "12px", textAlign: "left",
                      border: `2px solid ${selectedType === t.value ? "#2563eb" : "var(--border)"}`,
                      background: selectedType === t.value ? "#eff6ff" : "var(--bg-elevated)",
                      cursor: t.available ? "pointer" : "not-allowed",
                      opacity: t.available ? 1 : 0.5,
                    }}
                  >
                    <span style={{ fontSize: "28px" }}>{t.icon}</span>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {t.label}
                      </div>
                      {!t.available && (
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Čoskoro</div>
                      )}
                    </div>
                    {selectedType === t.value && (
                      <span style={{ marginLeft: "auto", color: "#2563eb", fontSize: "20px" }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                style={{
                  width: "100%", padding: "13px", borderRadius: "12px",
                  background: "#2563eb", color: "#fff",
                  border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer",
                }}
              >
                Pokračovať →
              </button>
            </>
          )}

          {/* Krok 2 — formulár */}
          {step === 2 && (
            <>
              {/* Back link */}
              <button
                onClick={() => setStep(1)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#2563eb", fontSize: "13px", padding: "0 0 16px",
                  display: "flex", alignItems: "center", gap: "4px",
                }}
              >
                ← Zmeniť typ
              </button>

              <FotoVideoForm
                klient={klient}
                makler={makler}
                onSave={handleSave}
                onCancel={onClose}
                saving={saving}
              />

              {error && (
                <div style={{
                  marginTop: "12px", padding: "10px 14px", borderRadius: "8px",
                  background: "#fef2f2", border: "1px solid #fecaca",
                  color: "#dc2626", fontSize: "13px",
                }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { STAV_COLORS };
