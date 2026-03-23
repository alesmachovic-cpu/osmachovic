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
      background: "linear-gradient(180deg, #F0F2F5 0%, #E5E7EB 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: "80px", height: "80px", borderRadius: "22px",
        background: "#374151",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "36px", marginBottom: "20px",
      }}>🏢</div>

      <h1 style={{
        fontSize: "28px", fontWeight: "700", color: "#1F2937",
        margin: "0 0 4px", letterSpacing: "-0.02em",
      }}>
        Machovič CRM
      </h1>
      <p style={{
        fontSize: "15px", color: "#6B7280", margin: "0 0 40px",
        fontWeight: "400",
      }}>
        {selected && needsPassword ? `Prihlásenie — ${selectedAccount?.name}` : "Vyber účet"}
      </p>

      <div style={{
        display: "flex", flexDirection: "column", gap: "12px",
        width: "100%", maxWidth: "380px",
      }}>
        {selected && needsPassword ? (
          <div style={{
            background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(0,0,0,0.08)", borderRadius: "16px",
            padding: "24px 20px", textAlign: "center",
          }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "#374151", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px", fontWeight: "800", margin: "0 auto 12px",
            }}>{selectedAccount?.initials}</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#1F2937", marginBottom: "4px" }}>
              {selectedAccount?.name}
            </div>
            <div style={{ fontSize: "12px", color: "#9CA3AF", marginBottom: "20px" }}>
              {selectedAccount?.role}
            </div>

            <input
              type="password"
              placeholder="Zadaj heslo"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handlePasswordSubmit(); }}
              autoFocus
              style={{
                width: "100%", padding: "12px 16px", borderRadius: "10px",
                border: error ? "2px solid #EF4444" : "1px solid #D1D5DB",
                fontSize: "16px", outline: "none", textAlign: "center",
                background: "#F9FAFB", boxSizing: "border-box",
              }}
            />

            {error && (
              <div style={{ fontSize: "12px", color: "#EF4444", marginTop: "8px", fontWeight: "500" }}>
                {error}
              </div>
            )}

            <button onClick={handlePasswordSubmit} disabled={animating} style={{
              width: "100%", padding: "12px", borderRadius: "10px", border: "none",
              background: "#374151", color: "#fff", fontSize: "14px", fontWeight: "600",
              cursor: animating ? "default" : "pointer", marginTop: "12px",
              opacity: animating ? 0.6 : 1,
            }}>
              {animating ? "Prihlasujem..." : "Prihlásiť"}
            </button>

            <button onClick={() => { setSelected(null); setError(""); }} style={{
              background: "none", border: "none", fontSize: "13px",
              color: "#6B7280", cursor: "pointer", marginTop: "12px", padding: "8px",
            }}>
              ← Späť na výber účtu
            </button>
          </div>
        ) : (
          accounts.map(account => {
            const isSelected = selected === account.id && animating;
            return (
              <button
                key={account.id}
                onClick={() => handleSelect(account.id)}
                disabled={animating}
                style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "16px 20px",
                  background: isSelected ? "#374151" : "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(20px)",
                  border: isSelected ? "2px solid #374151" : "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "16px",
                  cursor: animating ? "default" : "pointer",
                  transition: "all 0.3s ease",
                  transform: isSelected ? "scale(0.97)" : "scale(1)",
                  boxShadow: isSelected
                    ? "0 4px 12px rgba(55,65,81,0.3)"
                    : "0 2px 8px rgba(0,0,0,0.04)",
                  textAlign: "left",
                  opacity: animating && !isSelected ? 0.4 : 1,
                }}
              >
                <div style={{
                  width: "48px", height: "48px", borderRadius: "50%",
                  background: isSelected ? "rgba(255,255,255,0.2)" : "#E5E7EB",
                  color: isSelected ? "#fff" : "#374151",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", fontWeight: "800", flexShrink: 0,
                  transition: "all 0.3s",
                }}>
                  {account.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "15px", fontWeight: "600",
                    color: isSelected ? "#fff" : "#1F2937",
                    transition: "color 0.3s",
                  }}>
                    {account.name}
                  </div>
                  <div style={{
                    fontSize: "12px",
                    color: isSelected ? "rgba(255,255,255,0.7)" : "#9CA3AF",
                    marginTop: "2px",
                    transition: "color 0.3s",
                  }}>
                    {account.role}
                  </div>
                </div>
                {account.password ? (
                  <span style={{ fontSize: "14px", color: "#9CA3AF" }}>🔒</span>
                ) : (
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "50%",
                    border: isSelected ? "none" : "2px solid #D1D5DB",
                    background: isSelected ? "#fff" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", color: "#374151",
                    transition: "all 0.3s",
                    flexShrink: 0,
                  }}>
                    {isSelected && "✓"}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      <p style={{
        fontSize: "11px", color: "#9CA3AF", marginTop: "32px",
        textAlign: "center", lineHeight: "1.5",
      }}>
        Testovacia verzia · v9.6
      </p>
    </div>
  );
}

export type { User };
