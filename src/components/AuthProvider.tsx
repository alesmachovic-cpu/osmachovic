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
  loginWithGoogle: () => Promise<void>;
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
  loginWithGoogle: async () => {},
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

  // Helper: priradí Supabase session email k našemu `users` whitelist záznamu
  async function matchSessionToUser(email: string | null | undefined, accs: User[]): Promise<User | null> {
    if (!email) return null;
    const found = accs.find(a => a.email?.toLowerCase() === email.toLowerCase());
    return found || null;
  }

  useEffect(() => {
    (async () => {
      const accs = await loadAccounts();
      setAccounts(accs);

      // 1) Skús Supabase session (Google OAuth)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const matched = await matchSessionToUser(session.user.email, accs);
        if (matched) {
          setUser(matched);
          localStorage.setItem("crm_user", matched.id);
          setChecking(false);
          return;
        } else {
          // Prihlásený cez Google, ale email nie je vo whitelist — odhlás
          console.warn("[auth] Google session, but email not in users whitelist:", session.user.email);
          await supabase.auth.signOut();
        }
      }

      // 2) Fallback: legacy password login (localStorage)
      const saved = localStorage.getItem("crm_user");
      if (saved) {
        const found = accs.find(a => a.id === saved);
        if (found) setUser(found);
      }
      setChecking(false);
    })();

    // Listener na zmenu Supabase session (napr. po OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email) {
        const accs = await loadAccounts();
        setAccounts(accs);
        const matched = await matchSessionToUser(session.user.email, accs);
        if (matched) {
          setUser(matched);
          localStorage.setItem("crm_user", matched.id);
        } else {
          alert(`Tento Google účet (${session.user.email}) nie je povolený. Požiadaj admina o prístup.`);
          await supabase.auth.signOut();
          setUser(null);
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => { subscription.unsubscribe(); };
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
    // Po prihláseni presmeruj na Prehľad
    if (typeof window !== "undefined") {
      setTimeout(() => { window.location.href = "/"; }, 50);
    }
    return null;
  }

  async function loginWithGoogle(): Promise<void> {
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
  }

  async function logout() {
    localStorage.removeItem("crm_user");
    await supabase.auth.signOut();
    setUser(null);
    if (typeof window !== "undefined") window.location.href = "/";
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
      <AuthContext.Provider value={{ user, accounts, login, loginWithGoogle, logout, updateAccount, addAccount, deleteAccount, refreshAccounts }}>
        <LoginScreen accounts={accounts} onLogin={login} onGoogleLogin={loginWithGoogle} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, accounts, login, loginWithGoogle, logout, updateAccount, addAccount, deleteAccount, refreshAccounts }}>
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

function LoginScreen({ accounts, onLogin, onGoogleLogin }: { accounts: User[]; onLogin: (id: string, pw: string) => Promise<string | null>; onGoogleLogin: () => Promise<void> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [animating, setAnimating] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    try { await onGoogleLogin(); } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGoogleLoading(false);
    }
  }

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
                  : showLegacy ? "Vyber svoj účet" : "Pokračuj cez Google účet"
                }
              </p>
            </div>

            {/* Google Sign In — PRIMARY */}
            {!selected && !showLegacy && (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: "14px",
                    background: "#fff", color: "#1f2937",
                    border: "none", fontSize: "14px", fontWeight: 600,
                    cursor: googleLoading ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    opacity: googleLoading ? 0.7 : 1,
                    transition: "all 0.15s",
                    marginBottom: "16px",
                  }}
                >
                  {googleLoading ? (
                    <>
                      <span style={{ width: "16px", height: "16px", border: "2px solid #e5e7eb", borderTopColor: "#374151", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                      Pripájam Google...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Prihlásiť sa cez Google
                    </>
                  )}
                </button>

                {accounts.length > 0 && (
                  <button
                    onClick={() => setShowLegacy(true)}
                    style={{
                      fontSize: "12px", color: "rgba(255,255,255,0.5)", background: "none",
                      border: "none", cursor: "pointer", textAlign: "center", padding: "4px",
                      marginBottom: "8px",
                    }}
                  >
                    alebo prihlásiť heslom →
                  </button>
                )}
              </>
            )}

            {(selected || showLegacy) && (
              <div style={{ marginBottom: "12px", textAlign: "center" }}>
                <button
                  onClick={() => { setShowLegacy(false); setSelected(null); setPassword(""); setError(""); }}
                  style={{
                    fontSize: "12px", color: "rgba(255,255,255,0.5)", background: "none",
                    border: "none", cursor: "pointer", padding: "4px",
                  }}
                >
                  ← Späť na Google prihlásenie
                </button>
              </div>
            )}

            {(showLegacy || selected) && (
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
            )}
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
