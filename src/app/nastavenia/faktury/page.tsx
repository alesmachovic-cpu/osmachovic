"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getUserItem } from "@/lib/userStorage";

export type DodavatelSettings = {
  nazov: string;
  adresa: string;
  ico: string;
  dic: string;
  ic_dph: string;
  iban: string;
  banka: string;
  swift: string;
  obch_register: string;
  konst_symbol: string;
  email: string;
  telefon: string;
  splatnost_dni: number;
  uvodny_text: string;
  poznamka_default: string;
  vystavil: string;
  podpis_data: string;
};

export const DEFAULT_DODAVATEL: DodavatelSettings = {
  nazov: "",
  adresa: "",
  ico: "",
  dic: "",
  ic_dph: "",
  iban: "",
  banka: "",
  swift: "",
  obch_register: "",
  konst_symbol: "",
  email: "",
  telefon: "",
  splatnost_dni: 14,
  uvodny_text: "",
  poznamka_default: "",
  vystavil: "",
  podpis_data: "",
};

const STORAGE_KEY = "faktury_dodavatel"; // legacy localStorage key (auto-migrated 1×)

/**
 * Načíta dodávateľské údaje pre maklera z DB.
 * Pri prvom načítaní auto-migruje legacy údaje z localStorage do DB
 * (jednorazovo — po úspešnom uložení sa localStorage záznam zmaže).
 */
export async function fetchDodavatel(userId: string): Promise<DodavatelSettings> {
  // 1) skús DB
  try {
    const r = await fetch(`/api/dodavatel?user_id=${encodeURIComponent(userId)}`);
    if (r.ok) {
      const data = await r.json();
      if (data) return { ...DEFAULT_DODAVATEL, ...data };
    }
  } catch { /* sieťová chyba — fallback na default */ }

  // 2) legacy migrácia: ak je niečo v localStorage, uložím do DB a vyčistím
  if (typeof window !== "undefined") {
    const raw = getUserItem(userId, STORAGE_KEY);
    if (raw) {
      try {
        const parsed = { ...DEFAULT_DODAVATEL, ...JSON.parse(raw) };
        await saveDodavatel(userId, parsed);
        // legacy kľúče: per-user a global ("ales" fallback)
        try { localStorage.removeItem(`${STORAGE_KEY}__${userId}`); } catch {}
        try { if (userId === "ales") localStorage.removeItem(STORAGE_KEY); } catch {}
        return parsed;
      } catch { /* zlá JSON — ignoruj */ }
    }
  }

  return DEFAULT_DODAVATEL;
}

export async function saveDodavatel(userId: string, s: DodavatelSettings): Promise<void> {
  await fetch(`/api/dodavatel`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...s }),
  });
}

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

export default function NastaveniaFakturyPage() {
  const { user } = useAuth();
  const [s, setS] = useState<DodavatelSettings>(DEFAULT_DODAVATEL);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [icoLooking, setIcoLooking] = useState(false);
  const [icoErr, setIcoErr] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef<[number, number][][]>([]);
  const currentStrokeRef = useRef<[number, number][]>([]);
  const podpisNacitanyRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchDodavatel(user.id).then(setS);
  }, [user?.id]);

  function redrawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a3abf";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0][0], stroke[0][1]);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i][0], stroke[i][1]);
      ctx.stroke();
    }
  }

  useEffect(() => {
    if (!s.podpis_data || podpisNacitanyRef.current) return;
    try {
      const parsed = JSON.parse(s.podpis_data) as { strokes: [number, number][][]; w: number; h: number };
      if (parsed.strokes?.length) {
        strokesRef.current = parsed.strokes;
        podpisNacitanyRef.current = true;
        requestAnimationFrame(redrawCanvas);
      }
    } catch { /* ignoruj zlý JSON */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.podpis_data]);

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return [(t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY];
    }
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  function podpisStart(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getCanvasPos(e);
    currentStrokeRef.current = [pos];
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#1a3abf";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pos[0], pos[1]);
  }

  function podpisDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const pos = getCanvasPos(e);
    currentStrokeRef.current.push(pos);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(pos[0], pos[1]);
    ctx.stroke();
  }

  function podpisEnd() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStrokeRef.current.length >= 2) {
      strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
    }
    currentStrokeRef.current = [];
    const canvas = canvasRef.current!;
    setS(prev => ({ ...prev, podpis_data: JSON.stringify({ strokes: strokesRef.current, w: canvas.width, h: canvas.height }) }));
  }

  function clearPodpis() {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    podpisNacitanyRef.current = true;
    redrawCanvas();
    setS(prev => ({ ...prev, podpis_data: "" }));
  }

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    await saveDodavatel(user.id, s);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function lookupIco() {
    const ico = s.ico.replace(/\s/g, "");
    if (!ico) return;
    setIcoLooking(true);
    setIcoErr("");
    try {
      const r = await fetch(`/api/ico-lookup?ico=${encodeURIComponent(ico)}`);
      const d = await r.json();
      if (!r.ok) { setIcoErr(d.error || "Nenájdené"); return; }
      setS((prev) => ({
        ...prev,
        nazov: d.nazov || prev.nazov,
        adresa: d.adresa || prev.adresa,
        dic: d.dic || prev.dic,
        ic_dph: d.ic_dph || prev.ic_dph,
      }));
    } catch {
      setIcoErr("Chyba siete");
    } finally {
      setIcoLooking(false);
    }
  }

  function field(k: keyof DodavatelSettings, label: string, type: string = "text") {
    return (
      <div>
        <div style={labelSt}>{label}</div>
        <input
          style={inputSt}
          type={type}
          value={s[k] as string | number}
          onChange={(e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value })}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <Link href="/nastavenia" style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "none" }}>← Späť na nastavenia</Link>
      <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151", marginTop: "8px" }}>Nastavenia faktúr</h1>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
        Údaje dodávateľa, ktoré sa vytlačia na faktúre
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dodávateľ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {field("nazov", "Názov spoločnosti")}
          {field("adresa", "Adresa")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <div style={labelSt}>IČO</div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  style={{ ...inputSt, width: "auto", flex: 1, minWidth: 0 }}
                  value={s.ico}
                  onChange={(e) => setS({ ...s, ico: e.target.value })}
                />
                <button
                  onClick={lookupIco}
                  disabled={icoLooking || !s.ico.trim()}
                  title="Nájsť údaje podľa IČO"
                  style={{
                    flexShrink: 0,
                    padding: "0 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: icoLooking || !s.ico.trim() ? "not-allowed" : "pointer",
                    opacity: icoLooking || !s.ico.trim() ? 0.5 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {icoLooking ? "…" : "Nájsť"}
                </button>
              </div>
              {icoErr && <div style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>{icoErr}</div>}
            </div>
            {field("dic", "DIČ")}
            {field("ic_dph", "IČ DPH")}
          </div>
          {field("obch_register", "Obchodný register (napr. Obch. reg Okres. súdu BA I, oddiel: Sro, vložka č. 162664/B)")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {field("email", "Email")}
            {field("telefon", "Telefón")}
          </div>
        </div>

        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", margin: "24px 0 12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Bankové údaje</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
          {field("iban", "IBAN")}
          {field("banka", "Banka")}
          {field("swift", "SWIFT / BIC")}
        </div>
        <div style={{ marginTop: "12px" }}>
          {field("konst_symbol", "Konštantný symbol")}
        </div>

        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", margin: "24px 0 12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Predvolené hodnoty</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
          {field("splatnost_dni", "Splatnosť (dní)", "number")}
          {field("vystavil", "Vystavil (meno)")}
        </div>
        <div style={{ marginTop: "12px" }}>
          {field("poznamka_default", "Predvolená poznámka")}
        </div>

        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", margin: "24px 0 12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Podpis</div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>Nakreslite podpis — automaticky sa pridá k faktúram v modrej farbe</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <canvas
            ref={canvasRef}
            width={300}
            height={120}
            style={{
              display: "block",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "#fff",
              cursor: "crosshair",
              touchAction: "none",
              maxWidth: "100%",
            }}
            onMouseDown={podpisStart}
            onMouseMove={podpisDraw}
            onMouseUp={podpisEnd}
            onMouseLeave={podpisEnd}
            onTouchStart={podpisStart}
            onTouchMove={podpisDraw}
            onTouchEnd={podpisEnd}
          />
          <button
            onClick={clearPodpis}
            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            Vymazať
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          {saved && <span style={{ color: "var(--success)", fontSize: "13px", fontWeight: 600, alignSelf: "center" }}>✓ Uložené</span>}
          <button onClick={save} disabled={saving} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
            {saving ? "Ukladám…" : "Uložiť nastavenia"}
          </button>
        </div>
      </div>
    </div>
  );
}
