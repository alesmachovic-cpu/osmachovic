"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

type Company = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  user_count: number;
  stripe_subscription_id: string | null;
  plan_valid_until: string | null;
  created_at: string;
  email: string | null;
};

const PLAN_COLORS: Record<string, string> = {
  starter: "#6B7280",
  pro: "#2563EB",
  enterprise: "#7C3AED",
};

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "platform_admin") {
      router.push("/");
      return;
    }
    loadCompanies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadCompanies() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/companies");
      const data = await res.json() as { companies?: Company[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Chyba");
      setCompanies(data.companies || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(company: Company) {
    setSaving(company.id);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: company.id, is_active: !company.is_active }),
      });
      if (!res.ok) throw new Error("Chyba");
      setCompanies(cs => cs.map(c => c.id === company.id ? { ...c, is_active: !c.is_active } : c));
    } catch { /* ignore */ }
    setSaving(null);
  }

  async function setPlan(company: Company, plan: string) {
    setSaving(company.id);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: company.id, plan }),
      });
      if (!res.ok) throw new Error("Chyba");
      setCompanies(cs => cs.map(c => c.id === company.id ? { ...c, plan } : c));
    } catch { /* ignore */ }
    setSaving(null);
  }

  if (!user) return null;
  if (user.role !== "platform_admin") return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F7", padding: "32px 24px", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111", margin: 0 }}>Platform Admin</h1>
            <p style={{ fontSize: "13px", color: "#6B7280", margin: "4px 0 0" }}>
              {companies.length} kancelárií celkovo
            </p>
          </div>
          <button onClick={loadCompanies} style={{
            padding: "8px 16px", borderRadius: "8px", border: "1px solid #E5E7EB",
            background: "#fff", fontSize: "13px", cursor: "pointer",
          }}>
            Obnoviť
          </button>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", color: "#991B1B", fontSize: "13px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", color: "#6B7280", padding: "60px 0", fontSize: "14px" }}>Načítavam...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {companies.map(company => (
              <div key={company.id} style={{
                background: "#fff", borderRadius: "12px", padding: "16px 20px",
                border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: "16px",
                opacity: company.is_active ? 1 : 0.6,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "#111" }}>{company.name}</span>
                    <span style={{ fontSize: "11px", color: "#9CA3AF", fontFamily: "monospace" }}>{company.slug}</span>
                    <span style={{
                      fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "99px",
                      background: (PLAN_COLORS[company.plan] ?? "#6B7280") + "1A",
                      color: PLAN_COLORS[company.plan] ?? "#6B7280",
                      letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                      {company.plan}
                    </span>
                    {!company.is_active && (
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "99px", background: "#FEF2F2", color: "#DC2626", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        POZASTAVENÉ
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "3px" }}>
                    {company.user_count} {company.user_count === 1 ? "používateľ" : "používatelia"} · {company.email || "bez emailu"} · reg. {new Date(company.created_at).toLocaleDateString("sk")}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <select
                    value={company.plan}
                    onChange={e => setPlan(company, e.target.value)}
                    disabled={saving === company.id}
                    style={{
                      padding: "6px 10px", borderRadius: "8px", border: "1px solid #E5E7EB",
                      fontSize: "12px", background: "#fff", cursor: "pointer",
                    }}
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>

                  <button
                    onClick={() => toggleActive(company)}
                    disabled={saving === company.id}
                    style={{
                      padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                      border: "1px solid",
                      borderColor: company.is_active ? "#FECACA" : "#BBF7D0",
                      background: company.is_active ? "#FEF2F2" : "#F0FDF4",
                      color: company.is_active ? "#DC2626" : "#16A34A",
                      cursor: "pointer",
                    }}
                  >
                    {company.is_active ? "Pozastaviť" : "Aktivovať"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
