"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Nehnutelnost } from "@/lib/database.types";

interface Versions { emotivny: string; technicky: string; kratky: string }

export default function AIWriterPage() {
  const [nehnutelnosti, setNehnutelnosti] = useState<Nehnutelnost[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [versions, setVersions] = useState<Versions | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("nehnutelnosti").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setNehnutelnosti(data ?? []); if (data?.[0]) setSelected(data[0].id); });
  }, []);

  async function generate() {
    const n = nehnutelnosti.find(x => x.id === selected);
    if (!n) return;
    setGenerating(true);
    setVersions(null);
    setError("");
    try {
      const res = await fetch("/api/ai-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nazov: n.nazov, typ: n.typ, lokalita: n.lokalita, cena: n.cena, plocha: n.plocha, izby: n.izby, stav: n.stav, popis: n.popis }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVersions(data);
    } catch (e) {
      setError("Generovanie zlyhalo. Skontroluj ANTHROPIC_API_KEY v .env.local");
    }
    setGenerating(false);
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const versionConfig = [
    { key: "emotivny", label: "😍 Emotívny", desc: "Príbehy a pocity — ideálny pre web", color: "var(--purple)" },
    { key: "technicky", label: "🔧 Technický", desc: "Fakty a parametre — pre portály", color: "var(--accent)" },
    { key: "kratky", label: "⚡ Krátky", desc: "Max 3 vety — pre Facebook/Instagram", color: "var(--success)" },
  ];

  return (
    <div style={{ maxWidth: "900px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px", color: "var(--text-primary)" }}>AI Writer — Generátor Inzerátov</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Claude AI napíše 3 verzie textu pre tvoju nehnuteľnosť</p>
      </div>

      {/* Selector */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Vyber nehnuteľnosť
            </label>
            {nehnutelnosti.length === 0
              ? <div style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
                  Najprv pridaj nehnuteľnosti do portfólia
                </div>
              : <select value={selected} onChange={e => setSelected(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13.5px", color: "var(--text-primary)", outline: "none" }}>
                  {nehnutelnosti.map(n => (
                    <option key={n.id} value={n.id}>{n.nazov}{n.cena != null ? ` — ${n.cena.toLocaleString("sk")} €` : ""}</option>
                  ))}
                </select>
            }
          </div>
          <button onClick={generate} disabled={generating || !selected}
            style={{ padding: "10px 24px", background: generating ? "#A5B4FC" : "var(--accent)", color: "#fff", border: "none", borderRadius: "9px", fontSize: "14px", fontWeight: "700", cursor: generating ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            {generating ? "✨ Generujem..." : "✨ Generovať texty"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: "12px", padding: "10px 14px", background: "#FEE2E2", borderRadius: "8px", fontSize: "13px", color: "#991B1B" }}>
            {error}
          </div>
        )}
      </div>

      {/* Placeholder before generation */}
      {!versions && !generating && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {versionConfig.map(v => (
            <div key={v.key} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", textAlign: "center", opacity: 0.6 }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>{v.label.split(" ")[0]}</div>
              <div style={{ fontWeight: "600", fontSize: "13.5px", color: "var(--text-primary)" }}>{v.label.split(" ").slice(1).join(" ")}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{v.desc}</div>
            </div>
          ))}
        </div>
      )}

      {generating && (
        <div style={{ padding: "50px", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>✨</div>
          <div style={{ fontWeight: "600" }}>Claude AI píše texty...</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Zvyčajne trvá 5-10 sekúnd</div>
        </div>
      )}

      {/* Results */}
      {versions && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {versionConfig.map(v => {
            const text = versions[v.key as keyof Versions];
            return (
              <div key={v.key} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-elevated)" }}>
                  <div>
                    <span style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>{v.label}</span>
                    <span style={{ marginLeft: "10px", fontSize: "12px", color: "var(--text-muted)" }}>{v.desc}</span>
                  </div>
                  <button onClick={() => copy(text, v.key)}
                    style={{ padding: "6px 14px", background: copied === v.key ? "var(--success)" : "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", color: copied === v.key ? "#fff" : "var(--text-secondary)" }}>
                    {copied === v.key ? "✓ Skopírované" : "Kopírovať"}
                  </button>
                </div>
                <div style={{ padding: "18px 20px", fontSize: "13.5px", color: "var(--text-primary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
