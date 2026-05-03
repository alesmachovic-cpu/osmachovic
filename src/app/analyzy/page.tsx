"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Klient, Nehnutelnost } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import UrlAnalyzeModal from "@/components/UrlAnalyzeModal";

export default function AnalyzyPage() {
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [nehnutelnosti, setNehnutelnosti] = useState<Nehnutelnost[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [urlModal, setUrlModal] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("klienti").select("*").order("created_at", { ascending: false }),
      supabase.from("nehnutelnosti").select("*").order("created_at", { ascending: false }),
    ]).then(([{ data: k }, { data: n }]) => {
      setKlienti(k ?? []);
      setNehnutelnosti(n ?? []);
      setLoading(false);
    });
  }, []);

  // Stats
  const totalPotencialnaProviziaMin = nehnutelnosti.reduce((s, n) => s + (n.cena ?? 0) * 0.02, 0);
  const totalPotencialnaProviziaMax = nehnutelnosti.reduce((s, n) => s + (n.cena ?? 0) * 0.04, 0);
  const avgCena = nehnutelnosti.length ? nehnutelnosti.reduce((s, n) => s + (n.cena ?? 0), 0) / nehnutelnosti.length : 0;

  // Status distribution
  const statusDist = klienti.reduce((acc, k) => {
    acc[k.status] = (acc[k.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Typ distribution
  const typNehDist = nehnutelnosti.reduce((acc, n) => {
    acc[n.typ] = (acc[n.typ] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typKliDist = klienti.reduce((acc, k) => {
    if (k.typ) acc[k.typ] = (acc[k.typ] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // This month
  const thisMonth = new Date();
  const klientiThisMonth = klienti.filter(k => {
    const d = new Date(k.created_at);
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
  }).length;

  function Bar({ val, max, color }: { val: number; max: number; color: string }) {
    return (
      <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", flex: 1 }}>
        <div style={{ width: `${max ? (val / max) * 100 : 0}%`, height: "100%", background: color, borderRadius: "4px" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px", color: "var(--text-primary)" }}>Analýzy & Report</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Manažérsky prehľad portfólia</p>
      </div>

      {loading ? <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* URL Analýza — vlož link z portálu, AI vytiahne dáta + spraví analýzu */}
          <div style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)",
            borderRadius: "16px", padding: "20px 24px", color: "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "22px" }}>🔍</span>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>Analýza nehnuteľnosti z URL</div>
                <div style={{ fontSize: "12px", opacity: 0.75, marginTop: "2px" }}>
                  Vlož link z nehnutelnosti.sk, reality.sk, bazos.sk, topreality.sk alebo z akéhokoľvek inzerátu
                </div>
              </div>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (urlInput.trim()) setUrlModal(true); }}
              style={{ display: "flex", gap: "8px", marginTop: "12px" }}
            >
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.nehnutelnosti.sk/..."
                style={{
                  flex: 1, padding: "11px 14px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#fff", fontSize: "13px", outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!urlInput.trim() || !/^https?:\/\//i.test(urlInput.trim())}
                style={{
                  padding: "11px 22px", borderRadius: "10px",
                  background: "#fff", color: "#1e3a8a",
                  border: "none", fontSize: "13px", fontWeight: 700,
                  cursor: urlInput.trim() && /^https?:\/\//i.test(urlInput.trim()) ? "pointer" : "default",
                  opacity: urlInput.trim() && /^https?:\/\//i.test(urlInput.trim()) ? 1 : 0.5,
                }}
              >
                Analyzovať
              </button>
            </form>
          </div>

          {/* Top stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
            {[
              { label: "Klienti celkom", value: klienti.length, icon: "👥", color: "var(--success)" },
              { label: "Tento mesiac", value: klientiThisMonth, icon: "📅", color: "var(--accent)" },
              { label: "Nehnuteľnosti", value: nehnutelnosti.length, icon: "🏠", color: "var(--warning)" },
              { label: "Priemerná cena", value: avgCena ? `${Math.round(avgCena / 1000)}k €` : "—", icon: "💰", color: "var(--purple)" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px", borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontSize: "18px", marginBottom: "6px" }}>{s.icon}</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pipeline */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid var(--success)" }}>
            <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)", marginBottom: "12px" }}>💰 Pipeline — Potenciálny zisk</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Celková hodnota portfólia</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-primary)" }}>
                  {nehnutelnosti.reduce((s, n) => s + (n.cena ?? 0), 0).toLocaleString("sk")} €
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Min. provízia (2%)</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--warning)" }}>
                  {Math.round(totalPotencialnaProviziaMin).toLocaleString("sk")} €
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Max. provízia (4%)</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--success)" }}>
                  {Math.round(totalPotencialnaProviziaMax).toLocaleString("sk")} €
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* Klienti by status */}
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px" }}>Klienti podľa statusu</div>
              {klienti.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Žiadni klienti</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.entries(statusDist).map(([status, count]) => (
                    <div key={status} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", minWidth: "140px" }}>{STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}</div>
                      <Bar val={count} max={klienti.length} color="var(--accent)" />
                      <div style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-primary)", minWidth: "30px", textAlign: "right" }}>{count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nehnuteľnosti by typ */}
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px" }}>Portfólio podľa typu</div>
              {nehnutelnosti.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Žiadne nehnuteľnosti</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.entries(typNehDist).map(([typ, count]) => (
                    <div key={typ} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", minWidth: "80px", textTransform: "capitalize" }}>{typ}</div>
                      <Bar val={count} max={nehnutelnosti.length} color="var(--success)" />
                      <div style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-primary)", minWidth: "30px", textAlign: "right" }}>{count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nehnuteľnosti table */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>
              Top nehnuteľnosti v portfóliu
            </div>
            {nehnutelnosti.slice(0, 5).map((n, i) => (
              <div key={n.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr", padding: "12px 20px", borderBottom: i < 4 ? "1px solid var(--border-subtle)" : "none", alignItems: "center", fontSize: "13.5px" }}>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{n.nazov}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{n.lokalita}</div>
                </div>
                <div style={{ fontWeight: "700", color: "var(--accent)" }}>{n.cena != null ? `${n.cena.toLocaleString("sk")} €` : "—"}</div>
                <div style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>{n.typ}</div>
                <div style={{ color: "var(--success)", fontSize: "12.5px" }}>
                  +{n.cena != null ? Math.round(n.cena * 0.03).toLocaleString("sk") : "—"} € (3%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {urlModal && (
        <UrlAnalyzeModal
          url={urlInput.trim()}
          onClose={() => setUrlModal(false)}
        />
      )}
    </div>
  );
}
