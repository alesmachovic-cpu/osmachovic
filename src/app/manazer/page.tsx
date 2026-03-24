"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface TeamStat {
  name: string;
  role: string;
  klienti: number;
  nabery: number;
  nehnutelnosti: number;
  konverzia: string;
}

interface MonthlyData {
  month: string;
  label: string;
  klienti: number;
  nabery: number;
}

export default function ManazerPage() {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ klienti: 0, nehnutelnosti: 0, nabery: 0, objednavky: 0 });
  const [team, setTeam] = useState<TeamStat[]>([]);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const [{ data: klienti }, { data: nehnutelnosti }, { data: nabery }, { data: objednavky }, { data: users }] =
      await Promise.all([
        supabase.from("klienti").select("id, makler_id, created_at, status, proviziaeur"),
        supabase.from("nehnutelnosti").select("id, makler, created_at, cena"),
        supabase.from("naberove_listy").select("id, makler_id, created_at"),
        supabase.from("objednavky").select("id, created_at"),
        supabase.from("users").select("id, name, role"),
      ]);

    const kl = klienti ?? [];
    const nh = nehnutelnosti ?? [];
    const nb = nabery ?? [];
    const ob = objednavky ?? [];
    const us = users ?? [];

    setTotals({
      klienti: kl.length,
      nehnutelnosti: nh.length,
      nabery: nb.length,
      objednavky: ob.length,
    });

    // Team stats
    const teamStats: TeamStat[] = us.map((u) => {
      const uk = kl.filter((k) => k.makler_id === u.id).length;
      const un = nb.filter((n) => n.makler_id === u.id).length;
      const unh = nh.filter((n) => n.makler === u.id).length;
      return {
        name: u.name,
        role: u.role || "makler",
        klienti: uk,
        nabery: un,
        nehnutelnosti: unh,
        konverzia: uk > 0 ? `${Math.round((un / uk) * 100)}%` : "0%",
      };
    });
    teamStats.sort((a, b) => b.klienti - a.klienti);
    setTeam(teamStats);

    // Monthly data (last 6 months)
    const months: MonthlyData[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("sk", { month: "short" });
      months.push({
        month: key,
        label,
        klienti: kl.filter((k) => k.created_at?.startsWith(key)).length,
        nabery: nb.filter((n) => n.created_at?.startsWith(key)).length,
      });
    }
    setMonthly(months);

    setLoading(false);
  }

  // KPI calculations
  const konverznyPomer = totals.klienti > 0 ? Math.round((totals.nabery / totals.klienti) * 100) : 0;
  const maxMonthly = Math.max(...monthly.map((m) => Math.max(m.klienti, m.nabery)), 1);

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
          Manažérsky pohľad
        </h1>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          Načítavam štatistiky...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
          Manažérsky pohľad
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
          Štatistiky a výkonnosť tímu
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Celkom klientov", value: totals.klienti, sub: "v databáze" },
          { label: "Nehnuteľnosti", value: totals.nehnutelnosti, sub: "aktívne" },
          { label: "Konverzný pomer", value: `${konverznyPomer}%`, sub: "nábery / klienti" },
          { label: "Objednávky", value: totals.objednavky, sub: "od kupujúcich" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              padding: "20px",
              background: "var(--bg-surface)",
              borderRadius: "14px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: "500" }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Additional KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Celkom náberov", value: totals.nabery },
          { label: "Maklérov v tíme", value: team.length },
          { label: "Priem. klientov/maklér", value: team.length > 0 ? Math.round(totals.klienti / team.length) : 0 },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "16px",
              background: "var(--bg-surface)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>
              {s.label}
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#374151" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div
        style={{
          padding: "24px",
          background: "var(--bg-surface)",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
          Mesačný trend
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 20px" }}>
          Noví klienti a nábery za posledných 6 mesiacov
        </p>

        {/* Legend */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#374151" }} />
            Klienti
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#9CA3AF" }} />
            Nábery
          </div>
        </div>

        {/* Bars */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", height: "140px" }}>
          {monthly.map((m) => (
            <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "4px", width: "100%" }}>
                <div
                  style={{
                    flex: 1,
                    background: "#374151",
                    borderRadius: "4px 4px 0 0",
                    height: `${Math.max((m.klienti / maxMonthly) * 100, 4)}%`,
                    minHeight: "4px",
                    position: "relative",
                  }}
                >
                  {m.klienti > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-18px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "10px",
                        fontWeight: "600",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {m.klienti}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "#9CA3AF",
                    borderRadius: "4px 4px 0 0",
                    height: `${Math.max((m.nabery / maxMonthly) * 100, 4)}%`,
                    minHeight: "4px",
                    position: "relative",
                  }}
                >
                  {m.nabery > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-18px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "10px",
                        fontWeight: "600",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {m.nabery}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "8px",
                  fontWeight: "500",
                  textTransform: "capitalize",
                }}
              >
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team performance table */}
      {team.length > 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
              Výkonnosť tímu
            </h3>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              padding: "12px 20px",
              fontSize: "11px",
              fontWeight: "600",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            <span>Maklér</span>
            <span style={{ textAlign: "center" }}>Klienti</span>
            <span style={{ textAlign: "center" }}>Nábery</span>
            <span style={{ textAlign: "center" }}>Nehnuteľnosti</span>
            <span style={{ textAlign: "right" }}>Konverzia</span>
          </div>
          {team.map((m, i) => (
            <div
              key={m.name}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: i < team.length - 1 ? "1px solid var(--border)" : "none",
                fontSize: "13px",
              }}
            >
              <div>
                <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{m.name}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {m.role === "admin" ? "Administrátor" : "Maklér"}
                </div>
              </div>
              <div style={{ textAlign: "center", fontWeight: "600", color: "var(--text-primary)" }}>{m.klienti}</div>
              <div style={{ textAlign: "center", fontWeight: "600", color: "var(--text-primary)" }}>{m.nabery}</div>
              <div style={{ textAlign: "center", fontWeight: "600", color: "var(--text-primary)" }}>{m.nehnutelnosti}</div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color: parseInt(m.konverzia) >= 50 ? "#059669" : parseInt(m.konverzia) >= 25 ? "#D97706" : "#374151",
                  }}
                >
                  {m.konverzia}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
