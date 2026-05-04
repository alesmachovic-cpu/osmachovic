"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

/* ── Typy ── */
interface Nehnutelnost {
  id: string;
  typ_nehnutelnosti: string | null;
  stav_inzeratu: string | null;
  cena: number | null;
  plocha: number | null;
  lokalita: string | null;
  created_at: string;
  makler_id: string | null;
  makler_email: string | null;
  makler: string | null;
}

interface MaklerOption {
  id: string;
  meno: string;
  email: string;
}

interface MonthBucket {
  label: string;
  count: number;
}

/* ── Helpers ── */
function fmt(n: number): string {
  return n.toLocaleString("sk");
}

function fmtEur(n: number): string {
  return n.toLocaleString("sk", { maximumFractionDigits: 0 }) + " €";
}

function pct(value: number, max: number): number {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

const TYP_LABELS: Record<string, string> = {
  byt: "Byt",
  dom: "Dom",
  pozemok: "Pozemok",
  garsonka: "Garsónka",
  "1-izbovy": "1i byt",
  "2-izbovy": "2i byt",
  "3-izbovy": "3i byt",
  "4-izbovy": "4i byt",
  "rodinny-dom": "Rodinný dom",
  chata: "Chata",
  komercny: "Komerčný",
};

const STAV_CONFIG: Record<string, { label: string; color: string }> = {
  aktivna: { label: "Aktívna", color: "#34C759" },
  "aktívny": { label: "Aktívny", color: "#34C759" },
  pripravujeme: { label: "Pripravujeme", color: "#FF9F0A" },
  pozastaveny: { label: "Pozastavený", color: "#FF9F0A" },
  predany: { label: "Predaný", color: "#8E8E93" },
  archiv: { label: "Archív", color: "#636366" },
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Máj", "Jún",
  "Júl", "Aug", "Sep", "Okt", "Nov", "Dec",
];

/* ── Shared card style ── */
const cardStyle: React.CSSProperties = {
  background: "var(--bg-elevated, #1C1C1E)",
  borderRadius: 16,
  padding: "20px 22px",
  border: "1px solid var(--border, rgba(255,255,255,0.08))",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary, #8E8E93)",
  marginBottom: 4,
  letterSpacing: 0.2,
};

const bigNumberStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: "var(--text-primary, #F5F5F7)",
  letterSpacing: -0.5,
  lineHeight: 1.1,
};

/* ── Component ── */
export default function Statistiky() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin" || user?.id === "ales";
  const [allData, setAllData] = useState<Nehnutelnost[]>([]);
  const [loading, setLoading] = useState(true);
  const [makleri, setMakleri] = useState<MaklerOption[]>([]);
  const [selectedMakler, setSelectedMakler] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("nehnutelnosti")
        .select("id, typ_nehnutelnosti, stav_inzeratu, cena, plocha, lokalita, created_at, makler_id, makler_email, makler");
      setAllData((rows as Nehnutelnost[]) ?? []);
      setLoading(false);
    })();
    supabase.from("makleri").select("id, meno, email").order("meno").then(({ data: m }) => {
      if (m) setMakleri(m as MaklerOption[]);
    });
  }, []);

  // Filter podľa vybraného makléra (TASK 12)
  const data = selectedMakler === "all"
    ? allData
    : allData.filter(n => {
        const sel = makleri.find(m => m.id === selectedMakler);
        if (!sel) return false;
        return n.makler_id === sel.id
          || (n.makler_email || "").toLowerCase() === (sel.email || "").toLowerCase()
          || (n.makler || "").toLowerCase() === sel.meno.toLowerCase();
      });

  /* ── Computed stats ── */
  const withPrice = data.filter((n) => n.cena && n.plocha && n.plocha > 0);
  const avgPriceM2 =
    withPrice.length > 0
      ? Math.round(
          withPrice.reduce((s, n) => s + n.cena! / n.plocha!, 0) /
            withPrice.length
        )
      : 0;

  // Typ breakdown — slugy mapujeme na ľudské labely (Byt / Dom / Pozemok / Komercia / Garáž)
  const TYPE_LABELS: Record<string, string> = {
    // Byty
    "byt": "Byt", "1-izbovy-byt": "Byt", "2-izbovy-byt": "Byt", "3-izbovy-byt": "Byt",
    "4-izbovy-byt": "Byt", "5-izbovy-byt": "Byt", "6-izbovy-byt": "Byt",
    "garsonka": "Byt", "loft": "Byt", "mezonet": "Byt",
    // Domy
    "dom": "Dom", "rodinny-dom": "Dom", "rodinny_dom": "Dom",
    "vila": "Dom", "chata": "Dom", "chalupa": "Dom",
    // Ostatné typy
    "pozemok": "Pozemok", "stavebny-pozemok": "Pozemok", "zahrada": "Pozemok",
    "komercia": "Komercia", "kancelaria": "Komercia", "obchodny-priestor": "Komercia",
    "sklad": "Komercia", "vyrobny-priestor": "Komercia",
    "garaz": "Garáž", "garazove-stojisko": "Garáž",
  };
  function normalizeTyp(raw: string | null | undefined): string {
    if (!raw) return "Ostatné";
    const key = String(raw).toLowerCase().trim();
    return TYPE_LABELS[key] ?? "Ostatné";
  }
  const typCounts: Record<string, number> = {};
  data.forEach((n) => {
    const t = normalizeTyp(n.typ_nehnutelnosti);
    typCounts[t] = (typCounts[t] || 0) + 1;
  });
  const typEntries = Object.entries(typCounts).sort((a, b) => b[1] - a[1]);
  const typMax = typEntries.length > 0 ? typEntries[0][1] : 1;

  // Stav breakdown
  const stavCounts: Record<string, number> = {};
  data.forEach((n) => {
    const s = n.stav_inzeratu || "neuvedený";
    stavCounts[s] = (stavCounts[s] || 0) + 1;
  });
  const stavEntries = Object.entries(stavCounts).sort((a, b) => b[1] - a[1]);
  const stavMax = stavEntries.length > 0 ? stavEntries[0][1] : 1;

  // Price ranges
  const priceRanges = [
    { label: "Do 100 000 €", min: 0, max: 100000 },
    { label: "100 – 200 000 €", min: 100000, max: 200000 },
    { label: "200 – 500 000 €", min: 200000, max: 500000 },
    { label: "Nad 500 000 €", min: 500000, max: Infinity },
  ];
  const priceBuckets = priceRanges.map((r) => ({
    ...r,
    count: data.filter((n) => n.cena !== null && n.cena >= r.min && n.cena < r.max).length,
  }));
  const priceMax = Math.max(...priceBuckets.map((b) => b.count), 1);

  // Monthly trend (last 6 months)
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const count = data.filter((n) => {
      const c = new Date(n.created_at);
      return c.getFullYear() === year && c.getMonth() === month;
    }).length;
    months.push({ label: MONTH_NAMES[month], count });
  }
  const monthMax = Math.max(...months.map((m) => m.count), 1);

  // Typ color palette
  const typColors = ["#0A84FF", "#5E5CE6", "#BF5AF2", "#FF375F", "#FF9F0A", "#30D158", "#64D2FF", "#AC8E68"];

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "var(--text-muted, #636366)",
          fontSize: 15,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
        }}
      >
        Načítavam štatistiky...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-surface, #000)",
        padding: "24px 20px 120px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text-primary, #F5F5F7)",
          margin: "0 0 4px",
          letterSpacing: -0.3,
        }}
      >
        Štatistiky nehnuteľností
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--text-secondary, #8E8E93)",
          margin: "0 0 16px",
        }}
      >
        {fmt(data.length)} nehnuteľností {selectedMakler === "all" ? "v databáze" : "pre vybraného makléra"}
      </p>

      {/* Filter podľa makléra — len pre super_admina (TASK 12) */}
      {isSuperAdmin && makleri.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <select
            value={selectedMakler}
            onChange={e => setSelectedMakler(e.target.value)}
            style={{
              padding: "9px 30px 9px 12px",
              background: "var(--bg-surface, #1c1c1e)",
              border: "1px solid var(--border, #38383A)",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--text-primary, #F5F5F7)",
              cursor: "pointer",
              outline: "none",
              appearance: "none" as const,
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              minWidth: "220px",
            }}
          >
            <option value="all">Všetci makléri</option>
            {makleri.map(m => (
              <option key={m.id} value={m.id}>{m.meno}</option>
            ))}
          </select>
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {/* ── 1. Priemerná cena za m² ── */}
        <div style={cardStyle}>
          <div style={labelStyle}>Priemerná cena za m²</div>
          <div style={bigNumberStyle}>{fmtEur(avgPriceM2)}</div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted, #636366)",
              marginTop: 8,
            }}
          >
            Na základe {fmt(withPrice.length)} nehnuteľností s cenou aj plochou
          </div>
        </div>

        {/* ── 2. Rozloženie podľa typu ── */}
        <div style={cardStyle}>
          <div style={labelStyle}>Rozloženie podľa typu</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {typEntries.slice(0, 6).map(([typ, count], i) => (
              <div key={typ}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "var(--text-primary, #F5F5F7)",
                    marginBottom: 4,
                  }}
                >
                  <span>{TYP_LABELS[typ] || typ}</span>
                  <span style={{ color: "var(--text-muted, #636366)" }}>{count}</span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: "var(--border, rgba(255,255,255,0.06))",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct(count, typMax)}%`,
                      borderRadius: 4,
                      background: typColors[i % typColors.length],
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. Rozloženie podľa stavu ── */}
        <div style={cardStyle}>
          <div style={labelStyle}>Rozloženie podľa stavu</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {stavEntries.map(([stav, count]) => {
              const cfg = STAV_CONFIG[stav] || {
                label: stav.charAt(0).toUpperCase() + stav.slice(1),
                color: "#8E8E93",
              };
              return (
                <div key={stav}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: "var(--text-primary, #F5F5F7)",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: cfg.color,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      {cfg.label}
                    </span>
                    <span style={{ color: "var(--text-muted, #636366)" }}>{count}</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: "var(--border, rgba(255,255,255,0.06))",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct(count, stavMax)}%`,
                        borderRadius: 4,
                        background: cfg.color,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. Cenová mapa ── */}
        <div style={cardStyle}>
          <div style={labelStyle}>Cenová mapa</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {priceBuckets.map((bucket) => (
              <div key={bucket.label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "var(--text-primary, #F5F5F7)",
                    marginBottom: 4,
                  }}
                >
                  <span>{bucket.label}</span>
                  <span style={{ color: "var(--text-muted, #636366)" }}>{bucket.count}</span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: "var(--border, rgba(255,255,255,0.06))",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct(bucket.count, priceMax)}%`,
                      borderRadius: 4,
                      background: "var(--accent, #0A84FF)",
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. Trend nových nehnuteľností ── */}
        <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <div style={labelStyle}>Nové nehnuteľnosti za posledných 6 mesiacov</div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              marginTop: 16,
              height: 140,
              paddingBottom: 24,
              position: "relative",
            }}
          >
            {months.map((m) => (
              <div
                key={m.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary, #F5F5F7)",
                    marginBottom: 6,
                  }}
                >
                  {m.count > 0 ? m.count : ""}
                </span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 48,
                    borderRadius: 8,
                    background:
                      m.count === monthMax
                        ? "var(--accent, #0A84FF)"
                        : "rgba(10, 132, 255, 0.35)",
                    height: `${pct(m.count, monthMax)}%`,
                    minHeight: m.count > 0 ? 6 : 2,
                    transition: "height 0.6s ease",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted, #636366)",
                    marginTop: 8,
                    position: "absolute",
                    bottom: 0,
                  }}
                >
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
