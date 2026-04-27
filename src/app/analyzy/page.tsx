"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Nehnutelnost } from "@/lib/database.types";
import { useAuth } from "@/components/AuthProvider";
import { getMaklerUuid } from "@/lib/maklerMap";

interface AnalyzaRow {
  id: string;
  nehnutelnost_id: string | null;
  typ: "quick_weekly" | "detailed" | "from_link" | "from_data";
  vstup: Record<string, unknown> | null;
  odhadovana_cena_eur: number | null;
  odporucany_cas_topovania_dni: number | null;
  analyza_text: string | null;
  konkurencia: Array<{ popis?: string; cena_eur?: number; lokalita?: string; plocha_m2?: number }> | null;
  meta: { cena_min?: number; cena_max?: number; postup?: string[]; zdovodnenie?: string; url?: string } | null;
  created_at: string;
}

type Tab = "tyzdenna" | "detailna" | "z_linku" | "z_udajov";

const TYP_LABELS: Record<string, string> = {
  quick_weekly: "Týždenná",
  detailed: "Detailná",
  from_link: "Z linku",
  from_data: "Z údajov",
};

const fmtPrice = (n: number | null | undefined) => n == null ? "—" : `${Math.round(n / 1000)}k €`;
const fmtTime = (iso: string) => new Date(iso).toLocaleString("sk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function AnalyzyPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("tyzdenna");
  const [myMaklerUuid, setMyMaklerUuid] = useState<string | null>(null);

  const [nehnutelnosti, setNehnutelnosti] = useState<Nehnutelnost[]>([]);
  const [analyzy, setAnalyzy] = useState<AnalyzaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Detailná: vybraná nehnuteľnosť
  const [selectedNehnId, setSelectedNehnId] = useState<string>("");
  const [detailedResult, setDetailedResult] = useState<AnalyzaRow | null>(null);

  // Z linku
  const [link, setLink] = useState("");
  const [linkResult, setLinkResult] = useState<AnalyzaRow | null>(null);

  // Z údajov
  const [formData, setFormData] = useState({ typ: "byt", lokalita: "", plocha: "", izby: "", cena: "", popis: "" });
  const [dataResult, setDataResult] = useState<AnalyzaRow | null>(null);

  useEffect(() => {
    if (user?.id) getMaklerUuid(user.id).then(setMyMaklerUuid);
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ns }, { data: as }] = await Promise.all([
      supabase.from("nehnutelnosti").select("*").neq("stav", "predane").neq("stav", "archivovane").order("created_at", { ascending: false }),
      supabase.from("analyzy_nehnutelnosti").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setNehnutelnosti((ns ?? []) as Nehnutelnost[]);
    setAnalyzy((as ?? []) as AnalyzaRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Najnovšia týždenná analýza per nehnutelnost_id
  const latestQuickByNehn: Record<string, AnalyzaRow> = {};
  for (const a of analyzy) {
    if (a.typ === "quick_weekly" && a.nehnutelnost_id && !latestQuickByNehn[a.nehnutelnost_id]) {
      latestQuickByNehn[a.nehnutelnost_id] = a;
    }
  }

  async function runWeeklyCron() {
    if (!confirm("Spustiť týždennú analýzu pre všetky aktívne nehnuteľnosti? Môže to trvať pár minút.")) return;
    setRunning(true);
    try {
      const r = await fetch("/api/cron/analyzy-tyzdenne?key=__internal__");
      const d = await r.json();
      alert(`✓ ${d.message || "Hotovo"}`);
      await load();
    } catch (e) {
      alert("Chyba: " + String(e).slice(0, 200));
    }
    setRunning(false);
  }

  async function runDetailed() {
    if (!selectedNehnId) { alert("Vyber nehnuteľnosť"); return; }
    setRunning(true);
    setDetailedResult(null);
    try {
      const r = await fetch("/api/analyzy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "detailed", nehnutelnost_id: selectedNehnId, makler_id: myMaklerUuid }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Chyba"); setRunning(false); return; }
      setDetailedResult(d.analyza);
      await load();
    } catch (e) { alert("Chyba: " + String(e).slice(0, 200)); }
    setRunning(false);
  }

  async function runFromLink() {
    if (!link.trim()) { alert("Vlož URL"); return; }
    setRunning(true);
    setLinkResult(null);
    try {
      const r = await fetch("/api/analyzy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "from_link", url: link.trim(), makler_id: myMaklerUuid }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Chyba"); setRunning(false); return; }
      setLinkResult(d.analyza);
      await load();
    } catch (e) { alert("Chyba: " + String(e).slice(0, 200)); }
    setRunning(false);
  }

  async function runFromData() {
    if (!formData.lokalita.trim() || !formData.plocha) { alert("Vyplň aspoň lokalitu a plochu"); return; }
    setRunning(true);
    setDataResult(null);
    try {
      const r = await fetch("/api/analyzy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "from_data",
          data: {
            typ: formData.typ, lokalita: formData.lokalita.trim(),
            plocha: Number(formData.plocha) || undefined,
            izby: Number(formData.izby) || undefined,
            cena: Number(formData.cena) || undefined,
            popis: formData.popis.trim() || undefined,
          },
          makler_id: myMaklerUuid,
        }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Chyba"); setRunning(false); return; }
      setDataResult(d.analyza);
      await load();
    } catch (e) { alert("Chyba: " + String(e).slice(0, 200)); }
    setRunning(false);
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            Analýza trhu
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            AI odhad ceny, odporúčaný čas topovania, konkurencia + analýza z linku alebo údajov
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: "4px", marginBottom: "20px", padding: "4px",
        background: "var(--bg-elevated)", borderRadius: "12px", border: "1px solid var(--border)", overflowX: "auto",
      }}>
        {[
          { key: "tyzdenna", label: "Týždenná (auto)" },
          { key: "detailna", label: "Detailná analýza" },
          { key: "z_linku", label: "Z linku" },
          { key: "z_udajov", label: "Z údajov" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)} style={{
            flex: 1, minWidth: "140px", padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
            background: tab === t.key ? "var(--bg-surface)" : "transparent",
            border: tab === t.key ? "1px solid var(--border)" : "1px solid transparent",
            fontSize: "13px", fontWeight: tab === t.key ? "700" : "500",
            color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
            whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}

      {/* TÝŽDENNÁ */}
      {!loading && tab === "tyzdenna" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {nehnutelnosti.length} aktívnych nehnuteľností · {Object.keys(latestQuickByNehn).length} analyzovaných
            </div>
            <button onClick={runWeeklyCron} disabled={running} style={{
              padding: "8px 16px", background: "#374151", color: "#fff",
              border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
              cursor: running ? "wait" : "pointer", opacity: running ? 0.6 : 1,
            }}>{running ? "Analyzujem..." : "Spustiť teraz"}</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {nehnutelnosti.map(n => {
              const a = latestQuickByNehn[String(n.id)];
              return (
                <div key={String(n.id)} style={{
                  padding: "14px 16px", background: "var(--bg-surface)",
                  border: "1px solid var(--border)", borderRadius: "10px",
                  display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {String(n.nazov || "Bez názvu")}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                      {[String(n.typ || ""), String(n.lokalita || ""), n.plocha ? `${n.plocha}m²` : "", n.izby ? `${n.izby}-izb` : ""].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                    <div style={{ minWidth: "100px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Aktuálna</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{fmtPrice(Number(n.cena))}</div>
                    </div>
                    <div style={{ minWidth: "100px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Odhad AI</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: a?.odhadovana_cena_eur ? "#10B981" : "var(--text-muted)" }}>
                        {fmtPrice(a?.odhadovana_cena_eur)}
                      </div>
                    </div>
                    <div style={{ minWidth: "100px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Topovať</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {a?.odporucany_cas_topovania_dni ? `${a.odporucany_cas_topovania_dni} dní` : "—"}
                      </div>
                    </div>
                  </div>
                  {a?.analyza_text && (
                    <div style={{ width: "100%", fontSize: "12px", color: "var(--text-secondary)", fontStyle: "italic", paddingTop: "10px", borderTop: "1px solid var(--border-subtle)" }}>
                      💡 {a.analyza_text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAILNÁ */}
      {!loading && tab === "detailna" && (
        <div>
          <div style={{ padding: "16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
              Vyber nehnuteľnosť na detailnú AI analýzu
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <select value={selectedNehnId} onChange={e => setSelectedNehnId(e.target.value)} style={selectSt}>
                <option value="">— vyber —</option>
                {nehnutelnosti.map(n => (
                  <option key={String(n.id)} value={String(n.id)}>
                    {String(n.nazov || "Bez názvu")} ({String(n.lokalita || "")})
                  </option>
                ))}
              </select>
              <button onClick={runDetailed} disabled={running || !selectedNehnId} style={primaryBtn(running || !selectedNehnId)}>
                {running ? "Analyzujem..." : "Spustiť detailnú analýzu"}
              </button>
            </div>
          </div>
          <DetailedResultView a={detailedResult} />
        </div>
      )}

      {/* Z LINKU */}
      {!loading && tab === "z_linku" && (
        <div>
          <div style={{ padding: "16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
              Vlož URL inzerátu (nehnutelnosti.sk, reality.sk, byty.sk, bazos.sk)
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://www.nehnutelnosti.sk/..."
                style={{ ...inputSt, flex: 1, minWidth: "300px" }} />
              <button onClick={runFromLink} disabled={running || !link.trim()} style={primaryBtn(running || !link.trim())}>
                {running ? "Analyzujem..." : "Analyzovať"}
              </button>
            </div>
          </div>
          <DetailedResultView a={linkResult} />
        </div>
      )}

      {/* Z ÚDAJOV */}
      {!loading && tab === "z_udajov" && (
        <div>
          <div style={{ padding: "16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
              Zadaj údaje o nehnuteľnosti
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={lblSt}>Typ</label>
                <select value={formData.typ} onChange={e => setFormData({ ...formData, typ: e.target.value })} style={inputSt}>
                  <option value="byt">Byt</option>
                  <option value="dom">Dom</option>
                  <option value="pozemok">Pozemok</option>
                  <option value="garaz">Garáž</option>
                  <option value="komercia">Komercia</option>
                </select>
              </div>
              <div>
                <label style={lblSt}>Lokalita *</label>
                <input value={formData.lokalita} onChange={e => setFormData({ ...formData, lokalita: e.target.value })}
                  placeholder="napr. Bratislava-Petržalka" style={inputSt} />
              </div>
              <div>
                <label style={lblSt}>Plocha (m²) *</label>
                <input type="number" value={formData.plocha} onChange={e => setFormData({ ...formData, plocha: e.target.value })}
                  placeholder="75" style={inputSt} />
              </div>
              <div>
                <label style={lblSt}>Izby</label>
                <input type="number" value={formData.izby} onChange={e => setFormData({ ...formData, izby: e.target.value })}
                  placeholder="3" style={inputSt} />
              </div>
              <div>
                <label style={lblSt}>Aktuálna cena (€)</label>
                <input type="number" value={formData.cena} onChange={e => setFormData({ ...formData, cena: e.target.value })}
                  placeholder="180000" style={inputSt} />
              </div>
            </div>
            <div>
              <label style={lblSt}>Popis (voliteľné)</label>
              <textarea value={formData.popis} onChange={e => setFormData({ ...formData, popis: e.target.value })}
                placeholder="napr. zrekonštruovaný, balkón, parkovanie, výhľad..."
                style={{ ...inputSt, minHeight: "60px", fontFamily: "inherit", resize: "vertical" }} />
            </div>
            <div style={{ marginTop: "12px" }}>
              <button onClick={runFromData} disabled={running} style={primaryBtn(running)}>
                {running ? "Analyzujem..." : "Spustiť analýzu"}
              </button>
            </div>
          </div>
          <DetailedResultView a={dataResult} />
        </div>
      )}
    </div>
  );
}

function DetailedResultView({ a }: { a: AnalyzaRow | null }) {
  if (!a) return null;
  const meta = a.meta || {};
  return (
    <div style={{ padding: "20px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
            {TYP_LABELS[a.typ] || a.typ} · {fmtTime(a.created_at)}
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#10B981", marginTop: "4px" }}>
            {fmtPrice(a.odhadovana_cena_eur)}
          </div>
          {(meta.cena_min || meta.cena_max) && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Rozsah: {fmtPrice(meta.cena_min)} – {fmtPrice(meta.cena_max)}
            </div>
          )}
        </div>
      </div>

      {a.analyza_text && (
        <div style={{ marginBottom: "16px" }}>
          <div style={sectionH}>Analýza trhu</div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {a.analyza_text}
          </div>
        </div>
      )}

      {meta.zdovodnenie && (
        <div style={{ marginBottom: "16px" }}>
          <div style={sectionH}>Prečo táto cena</div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {meta.zdovodnenie}
          </div>
        </div>
      )}

      {meta.postup && meta.postup.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={sectionH}>Odporučený postup predaja</div>
          <ol style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, paddingLeft: "20px", margin: 0 }}>
            {meta.postup.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      {a.konkurencia && a.konkurencia.length > 0 && (
        <div>
          <div style={sectionH}>Konkurencia na trhu</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {a.konkurencia.map((k, i) => (
              <div key={i} style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{k.popis}</div>
                <div style={{ marginTop: "2px" }}>
                  {k.lokalita && <>📍 {k.lokalita}</>}
                  {k.plocha_m2 && <> · {k.plocha_m2} m²</>}
                  {k.cena_eur && <> · 💰 {fmtPrice(k.cena_eur)}</>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sectionH: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px",
};
const lblSt: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600,
  color: "var(--text-muted)", marginBottom: "4px",
};
const inputSt: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", outline: "none",
};
const selectSt: React.CSSProperties = { ...inputSt, cursor: "pointer" };
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: "10px 18px", background: disabled ? "#9CA3AF" : "#374151",
  color: "#fff", border: "none", borderRadius: "8px",
  fontSize: "13px", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
});
