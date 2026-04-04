"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";

interface User {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  password?: string;
}

interface AuthContextType {
  user: User | null;
  accounts: User[];
  login: (userId: string, password: string) => Promise<string | null>;
  logout: () => void;
  updateAccount: (account: User) => Promise<void>;
  addAccount: (account: User) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  refreshAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accounts: [],
  login: async () => null,
  logout: () => {},
  updateAccount: async () => {},
  addAccount: async () => {},
  deleteAccount: async () => {},
  refreshAccounts: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [checking, setChecking] = useState(true);

  async function loadAccounts() {
    const { data } = await supabase.from("users").select("*").order("created_at");
    return (data ?? []) as User[];
  }

  useEffect(() => {
    (async () => {
      const accs = await loadAccounts();
      setAccounts(accs);
      const saved = localStorage.getItem("crm_user");
      if (saved) {
        const found = accs.find(a => a.id === saved);
        if (found) setUser(found);
      }
      setChecking(false);
    })();
  }, []);

  async function refreshAccounts() {
    const accs = await loadAccounts();
    setAccounts(accs);
  }

  async function login(userId: string, password: string): Promise<string | null> {
    const { data } = await supabase.from("users").select("*").eq("id", userId).single();
    if (!data) return "Účet neexistuje";
    const acc = data as User;
    if (acc.password && acc.password !== password) return "Nesprávne heslo";
    localStorage.setItem("crm_user", userId);
    setUser(acc);
    return null;
  }

  function logout() {
    localStorage.removeItem("crm_user");
    setUser(null);
  }

  async function updateAccount(updated: User) {
    await supabase.from("users").update({
      name: updated.name,
      initials: updated.initials,
      role: updated.role,
      email: updated.email,
      password: updated.password || "",
    }).eq("id", updated.id);
    await refreshAccounts();
    if (user?.id === updated.id) setUser(updated);
  }

  async function addAccount(account: User) {
    await supabase.from("users").insert({
      id: account.id,
      name: account.name,
      initials: account.initials,
      role: account.role,
      email: account.email,
      password: account.password || "",
    });
    await refreshAccounts();
  }

  async function deleteAccount(id: string) {
    await supabase.from("users").delete().eq("id", id);
    await refreshAccounts();
  }

  if (checking) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#F9FAFB",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "14px", background: "#374151",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "22px", margin: "0 auto 12px",
          }}>🏢</div>
          <div style={{ fontSize: "13px", color: "#9CA3AF", fontWeight: "500" }}>Načítavam...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, accounts, login, logout, updateAccount, addAccount, deleteAccount, refreshAccounts }}>
        <LoginScreen accounts={accounts} onLogin={login} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, accounts, login, logout, updateAccount, addAccount, deleteAccount, refreshAccounts }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Slovakia map SVG with branch city dots ── */
function SlovakiaMap() {
  // Approximate city positions on a 400x200 SVG canvas matching Slovakia's shape
  const cities = [
    { name: "Bratislava", x: 62, y: 132 },
    { name: "Trenčín", x: 130, y: 82 },
    { name: "Púchov", x: 145, y: 65 },
    { name: "Žilina", x: 170, y: 58 },
    { name: "Poprad", x: 265, y: 72 },
    { name: "Košice", x: 335, y: 105 },
  ];

  return (
    <svg viewBox="0 0 400 200" style={{ width: "100%", maxWidth: "440px", opacity: 0.9 }}>
      {/* Slovakia outline - simplified */}
      <path
        d="M55,140 Q58,125 62,118 Q68,108 80,100 Q88,95 95,90 Q100,88 108,85 Q115,82 122,78 Q128,74 135,68 Q140,62 148,56 Q155,50 165,46 Q172,44 180,42 Q190,40 200,38 Q210,37 220,38 Q230,40 240,42 Q250,45 258,50 Q265,55 272,60 Q278,62 285,65 Q295,68 305,72 Q315,78 325,85 Q335,92 342,100 Q348,108 352,115 Q355,122 355,130 Q354,138 350,145 Q345,150 338,152 Q330,154 320,150 Q312,146 305,142 Q298,138 290,136 Q282,135 274,136 Q265,137 256,140 Q248,142 240,145 Q232,148 224,150 Q216,151 208,150 Q200,148 192,145 Q184,142 176,140 Q168,139 160,140 Q152,142 144,144 Q136,146 128,148 Q120,149 112,148 Q104,146 96,144 Q88,142 80,142 Q72,142 65,142 Q58,142 55,140 Z"
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1.5"
      />
      {/* City dots and labels */}
      {cities.map(city => (
        <g key={city.name}>
          {/* Pulse ring */}
          <circle cx={city.x} cy={city.y} r="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1">
            <animate attributeName="r" from="5" to="12" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Dot */}
          <circle cx={city.x} cy={city.y} r="4" fill="#fff" opacity="0.9" />
          <circle cx={city.x} cy={city.y} r="2" fill="#374151" />
          {/* Label */}
          <text
            x={city.x}
            y={city.y - 12}
            textAnchor="middle"
            fill="rgba(255,255,255,0.8)"
            fontSize="9"
            fontWeight="600"
            fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
          >
            {city.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

function LoginScreen({ accounts, onLogin }: { accounts: User[]; onLogin: (id: string, pw: string) => Promise<string | null> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [animating, setAnimating] = useState(false);

  const selectedAccount = accounts.find(a => a.id === selected);
  const needsPassword = selectedAccount?.password && selectedAccount.password.length > 0;

  async function handleSelect(id: string) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;

    if (!acc.password) {
      setSelected(id);
      setAnimating(true);
      const err = await onLogin(id, "");
      if (err) { setError(err); setAnimating(false); }
    } else {
      setSelected(id);
      setPassword("");
      setError("");
    }
  }

  async function handlePasswordSubmit() {
    if (!selected) return;
    setAnimating(true);
    const err = await onLogin(selected, password);
    if (err) {
      setError(err);
      setAnimating(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle gradient orbs */}
      <div style={{
        position: "absolute", width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
        top: "-200px", right: "-100px", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: "500px", height: "500px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
        bottom: "-150px", left: "-100px", pointerEvents: "none",
      }} />

      {/* Top bar */}
      <div style={{
        padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "rgba(255,255,255,0.15)", backdropFilter: "blur(20px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>V</div>
          <span style={{ fontSize: "15px", fontWeight: "600", color: "rgba(255,255,255,0.9)", letterSpacing: "-0.01em" }}>VIANEMA</span>
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
          Realitný systém
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 24px 40px", position: "relative", zIndex: 2,
      }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          width: "100%", maxWidth: "900px", gap: "40px",
        }}>
          {/* Map section */}
          <div style={{ width: "100%", textAlign: "center" }}>
            <SlovakiaMap />
            <div style={{
              display: "flex", justifyContent: "center", gap: "20px", marginTop: "12px",
              flexWrap: "wrap",
            }}>
              {["Bratislava", "Trenčín", "Púchov", "Žilina", "Poprad", "Košice"].map(city => (
                <span key={city} style={{
                  fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: "500",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                  <span style={{
                    width: "5px", height: "5px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.4)", display: "inline-block",
                  }} />
                  {city}
                </span>
              ))}
            </div>
          </div>

          {/* Login card */}
          <div style={{
            width: "100%", maxWidth: "400px",
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
            borderRadius: "24px",
            border: "1px solid rgba(255,255,255,0.12)",
            padding: "32px 28px",
            boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
          }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <h1 style={{
                fontSize: "24px", fontWeight: "700",
                color: "#fff", margin: "0 0 6px",
                letterSpacing: "-0.02em",
              }}>
                Prihlásenie
              </h1>
              <p style={{
                fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0,
                fontWeight: "400",
              }}>
                {selected && needsPassword
                  ? selectedAccount?.name
                  : "Vyber svoj účet"
                }
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {selected && needsPassword ? (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "14px 16px", borderRadius: "14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: "4px",
                  }}>
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "50%",
                      background: "rgba(255,255,255,0.12)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "15px", fontWeight: "700", flexShrink: 0,
                    }}>{selectedAccount?.initials}</div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>
                        {selectedAccount?.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "1px" }}>
                        {selectedAccount?.role}
                      </div>
                    </div>
                  </div>

                  <input
                    type="password"
                    placeholder="Heslo"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handlePasswordSubmit(); }}
                    autoFocus
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: "12px",
                      border: error ? "1px solid #EF4444" : "1px solid rgba(255,255,255,0.1)",
                      fontSize: "15px", outline: "none",
                      background: "rgba(255,255,255,0.06)",
                      color: "#fff", boxSizing: "border-box",
                    }}
                  />

                  {error && (
                    <div style={{ fontSize: "12px", color: "#F87171", fontWeight: "500", textAlign: "center" }}>
                      {error}
                    </div>
                  )}

                  <button onClick={handlePasswordSubmit} disabled={animating} style={{
                    width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                    background: "rgba(255,255,255,0.95)", color: "#1a1a2e",
                    fontSize: "15px", fontWeight: "600",
                    cursor: animating ? "default" : "pointer", marginTop: "4px",
                    opacity: animating ? 0.6 : 1,
                    transition: "all 0.2s",
                  }}>
                    {animating ? "Prihlasujem..." : "Prihlásiť sa"}
                  </button>

                  <button onClick={() => { setSelected(null); setError(""); }} style={{
                    background: "none", border: "none", fontSize: "13px",
                    color: "rgba(255,255,255,0.5)", cursor: "pointer",
                    padding: "8px", textAlign: "center",
                  }}>
                    Späť na výber účtu
                  </button>
                </>
              ) : (
                accounts.map(account => {
                  const isSelected = selected === account.id && animating;
                  return (
                    <button
                      key={account.id}
                      onClick={() => handleSelect(account.id)}
                      disabled={animating}
                      style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "14px 16px",
                        background: isSelected
                          ? "rgba(255,255,255,0.15)"
                          : "rgba(255,255,255,0.04)",
                        border: "1px solid " + (isSelected ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"),
                        borderRadius: "14px",
                        cursor: animating ? "default" : "pointer",
                        transition: "all 0.25s ease",
                        transform: isSelected ? "scale(0.98)" : "scale(1)",
                        textAlign: "left",
                        opacity: animating && !isSelected ? 0.3 : 1,
                      }}
                    >
                      <div style={{
                        width: "44px", height: "44px", borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                        color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "14px", fontWeight: "700", flexShrink: 0,
                        transition: "all 0.25s",
                      }}>
                        {account.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: "14px", fontWeight: "600", color: "#fff",
                        }}>
                          {account.name}
                        </div>
                        <div style={{
                          fontSize: "11px", color: "rgba(255,255,255,0.4)",
                          marginTop: "2px",
                        }}>
                          {account.role}
                        </div>
                      </div>
                      {account.password ? (
                        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>🔒</span>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "16px 32px", textAlign: "center", position: "relative", zIndex: 2,
      }}>
        <p style={{
          fontSize: "11px", color: "rgba(255,255,255,0.25)", margin: 0,
          letterSpacing: "0.02em",
        }}>
          VIANEMA Reality · Machovič CRM v10.0
        </p>
      </div>
    </div>
  );
}

export type { User };
