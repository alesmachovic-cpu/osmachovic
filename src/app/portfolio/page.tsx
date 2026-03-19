"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Nehnutelnost, TypNehnutelnosti, StavNehnutelnosti } from "@/lib/database.types";

const LABEL: React.CSSProperties = { fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "5px", display: "block" };
const INPUT: React.CSSProperties = { width: "100%", padding: "9px 11px", background: "#fff", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "13.5px", color: "var(--text-primary)", outline: "none" };

const emptyForm = {
  nazov: "", typ: "byt" as TypNehnutelnosti,
  lokalita: "", cena: "",
  plocha: "", izby: "", poschodie: "",
  stav: "" as StavNehnutelnosti | "",
  popis: "", url_inzercia: "",
};

function scoreColor(s: number | null) {
  if (!s) return { bg: "#F3F4F6", text: "#9CA3AF" };
  if (s >= 8.5) return { bg: "#D1FAE5", text: "#065F46" };
  if (s >= 7.0) return { bg: "#FEF3C7", text: "#92400E" };
  return { bg: "#FEE2E2", text: "#991B1B" };
}

export default function PortfolioPage() {
  const [items, setItems] = useState<Nehnutelnost[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "byt" | "dom" | "pozemok">("all");

  async function fetch() {
    setLoading(true);
    const q = supabase.from("nehnutelnosti").select("*").order("created_at", { ascending: false });
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nazov.trim() || !form.lokalita.trim() || !form.cena) { setError("Názov, lokalita a cena sú povinné"); return; }
    setSaving(true);
    const { error: err } = await supabase.from("nehnutelnosti").insert({
      nazov: form.nazov.trim(),
      typ: form.typ,
      lokalita: form.lokalita.trim(),
      cena: Number(form.cena),
      plocha: form.plocha ? Number(form.plocha) : null,
      izby: form.izby ? Number(form.izby) : null,
      poschodie: form.poschodie ? Number(form.poschodie) : null,
      stav: (form.stav || null) as StavNehnutelnosti | null,
      popis: form.popis || null,
      url_inzercia: form.url_inzercia || null,
      ai_skore: null, ai_analyza: null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setModal(false);
    setForm(emptyForm);
    fetch();
  }

  async function analyzeNehnutelnost(n: Nehnutelnost) {
    setAnalyzingId(n.id);
    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nazov: n.nazov, typ: n.typ, lokalita: n.lokalita, cena: n.cena, plocha: n.plocha, izby: n.izby, stav: n.stav, popis: n.popis }),
      });
      const data = await res.json();
      if (!data.error) {
        await supabase.from("nehnutelnosti").update({ ai_skore: data.skore, ai_analyza: data.analyza }).eq("id", n.id);
        fetch();
      }
    } catch { /* silent */ }
    setAnalyzingId(null);
  }

  function whatsappShare(n: Nehnutelnost) {
    const text = `🏠 *${n.nazov}*\n📍 ${n.lokalita}${n.plocha ? `\n📐 ${n.plocha} m²` : ""}${n.izby ? ` · ${n.izby} izby` : ""}\n💰 *${n.cena != null ? n.cena.toLocaleString("sk") + " €" : "—"}*\n\nKontakt: Aleš Machovič, Vianema`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  const filtered = filter === "all" ? items : items.filter(i => i.typ === filter);

  return (
    <div style={{ maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 3px", color: "var(--text-primary)" }}>Portfólio</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>{items.length} nehnuteľností v databáze</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "4px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "3px" }}>
            {(["all","byt","dom","pozemok"] as const).map(t => (
              <button key={t} onClick={() => setFilter(t)}
                style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "12.5px", fontWeight: "500", border: "none", cursor: "pointer", background: filter === t ? "var(--accent)" : "transparent", color: filter === t ? "#fff" : "var(--text-secondary)" }}>
                {t === "all" ? "Všetky" : t.charAt(0).toUpperCase() + t.slice(1) + "y"}
              </button>
            ))}
          </div>
          <button onClick={() => { setModal(true); setError(""); }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "9px", fontSize: "13.5px", fontWeight: "600", cursor: "pointer" }}>
            + Pridať
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>🏠</div>
          Žiadne nehnuteľnosti. Klikni na <strong>+ Pridať</strong>.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {filtered.map(n => {
          const sc = scoreColor(n.ai_skore);
          return (
            <div key={n.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
              {/* Image placeholder */}
              <div style={{ height: "130px", background: "linear-gradient(135deg, #EBF0FF, #E0E7FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", position: "relative" }}>
                {n.typ === "byt" ? "🏢" : n.typ === "dom" ? "🏡" : "🌿"}
                {n.ai_skore && (
                  <div style={{ position: "absolute", top: "10px", right: "10px", padding: "3px 9px", borderRadius: "7px", fontSize: "12px", fontWeight: "800", background: sc.bg, color: sc.text }}>
                    {n.ai_skore}
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px" }}>{n.nazov}</div>
                <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                  {[n.lokalita, n.plocha ? `${n.plocha} m²` : null, n.izby ? `${n.izby} izby` : null].filter(Boolean).join(" · ")}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "17px", fontWeight: "800", color: "var(--accent)" }}>
                    {n.cena != null ? `${n.cena.toLocaleString("sk")} €` : "—"}
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "600", background: "var(--accent-light)", color: "var(--accent)" }}>
                      {n.typ.charAt(0).toUpperCase() + n.typ.slice(1)}
                    </span>
                    {n.stav && (
                      <span style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "11.5px", background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        {n.stav.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </div>
                {n.ai_analyza && (
                  <div style={{ marginTop: "10px", padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: "7px", fontSize: "12px", color: "var(--text-secondary)", borderLeft: "3px solid var(--accent)" }}>
                    {n.ai_analyza}
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: "12px", display: "flex", gap: "6px" }}>
                  <button onClick={() => analyzeNehnutelnost(n)} disabled={analyzingId === n.id}
                    style={{ flex: 1, padding: "7px", background: analyzingId === n.id ? "#EDE9FE" : "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "11.5px", fontWeight: "600", cursor: analyzingId === n.id ? "not-allowed" : "pointer", color: "var(--purple)" }}>
                    {analyzingId === n.id ? "✨ Analyzujem..." : "🤖 Analyzuj OS Machovič"}
                  </button>
                  <button onClick={() => whatsappShare(n)}
                    style={{ padding: "7px 10px", background: "#D1FAE5", border: "1px solid #A7F3D0", borderRadius: "7px", fontSize: "13px", cursor: "pointer" }}
                    title="Poslať cez WhatsApp">
                    📲
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: "var(--bg-surface)", borderRadius: "12px", border: "1px solid var(--border)", width: "100%", maxWidth: "580px", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-elevated)" }}>
              <span style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>+ Nová nehnuteľnosť</span>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "22px", lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: "20px 22px 22px", maxHeight: "75vh", overflowY: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* AI Scraper */}
                <div style={{ padding: "12px 14px", background: "#EBF0FF", border: "1px solid #C7D2FE", borderRadius: "8px" }}>
                  <div style={{ fontWeight: "700", fontSize: "13px", color: "#3730A3", marginBottom: "6px" }}>✨ AI Scraper</div>
                  <div style={{ fontSize: "12px", color: "#4338CA", marginBottom: "8px" }}>Vlož link (Bazoš, Nehnutelnosti.sk) a AI vyplní celý formulár.</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input placeholder="https://www.bazos.sk/..." style={{ ...INPUT, flex: 1, fontSize: "12.5px" }} disabled />
                    <button type="button" disabled style={{ padding: "8px 14px", background: "#6366F1", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12.5px", fontWeight: "600", cursor: "not-allowed", opacity: 0.7 }}>
                      Spustiť
                    </button>
                  </div>
                  <div style={{ fontSize: "11px", color: "#6366F1", marginTop: "4px" }}>Dostupné po prepojení AI API (Fáza 3)</div>
                </div>

                {/* Kategória + Typ */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={LABEL}>Kategória *</label>
                    <select style={INPUT} value={form.typ} onChange={e => set("typ", e.target.value)}>
                      <option value="byt">Byty</option>
                      <option value="dom">Domy</option>
                      <option value="pozemok">Pozemky</option>
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Stav</label>
                    <select style={INPUT} value={form.stav} onChange={e => set("stav", e.target.value)}>
                      <option value="">— vyber —</option>
                      <option value="novostavba">Novostavba</option>
                      <option value="rekonstruovana">Rekonštruovaná</option>
                      <option value="nova">Nová</option>
                      <option value="povodny_stav">Pôvodný stav</option>
                    </select>
                  </div>
                </div>

                {/* Názov */}
                <div>
                  <label style={LABEL}>Názov *</label>
                  <input style={INPUT} placeholder="napr. 3-izbový byt, Bratislava III" value={form.nazov} onChange={e => set("nazov", e.target.value)} />
                </div>

                {/* Cena + Výmera */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={LABEL}>Cena (€) *</label>
                    <input style={INPUT} type="number" placeholder="150 000" value={form.cena} onChange={e => set("cena", e.target.value)} />
                  </div>
                  <div>
                    <label style={LABEL}>Výmera (m²)</label>
                    <input style={INPUT} type="number" placeholder="65" value={form.plocha} onChange={e => set("plocha", e.target.value)} />
                  </div>
                </div>

                {/* Izby + Poschodie */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={LABEL}>Počet izieb</label>
                    <input style={INPUT} type="number" placeholder="3" value={form.izby} onChange={e => set("izby", e.target.value)} />
                  </div>
                  <div>
                    <label style={LABEL}>Poschodie</label>
                    <input style={INPUT} type="number" placeholder="3" value={form.poschodie} onChange={e => set("poschodie", e.target.value)} />
                  </div>
                </div>

                {/* Lokalita */}
                <div>
                  <label style={LABEL}>Lokalita *</label>
                  <input style={INPUT} placeholder="napr. Bratislava III, Ružinov" value={form.lokalita} onChange={e => set("lokalita", e.target.value)} />
                </div>

                {/* URL */}
                <div>
                  <label style={LABEL}>URL Inzerátu</label>
                  <input style={INPUT} placeholder="https://..." value={form.url_inzercia} onChange={e => set("url_inzercia", e.target.value)} />
                </div>

                {/* Popis */}
                <div>
                  <label style={LABEL}>Popis</label>
                  <textarea style={{ ...INPUT, resize: "none", height: "80px" }} placeholder="Krátky popis..." value={form.popis} onChange={e => set("popis", e.target.value)} />
                </div>
              </div>

              {error && <div style={{ marginTop: "12px", padding: "10px 12px", background: "#FEE2E2", borderRadius: "7px", fontSize: "13px", color: "#991B1B" }}>{error}</div>}

              <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                <button type="button" onClick={() => setModal(false)}
                  style={{ flex: 1, padding: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13.5px", fontWeight: "500", cursor: "pointer", color: "var(--text-secondary)" }}>
                  Zrušiť
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex: 2, padding: "10px", background: saving ? "#93C5FD" : "var(--accent)", border: "none", borderRadius: "8px", fontSize: "13.5px", fontWeight: "600", cursor: saving ? "not-allowed" : "pointer", color: "#fff" }}>
                  {saving ? "Ukladám..." : "Uložiť a publikovať"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
