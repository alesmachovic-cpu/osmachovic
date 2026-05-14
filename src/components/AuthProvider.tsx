"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { VianemaBranded, PoweredByAMGD } from "@/components/brand";
import PasswordInput from "@/components/PasswordInput";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

interface User {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;        // Business email (napr. @vianema.eu) — faktúry, komunikácia
  login_email?: string; // Google email (Gmail) pre OAuth login — môže byť rôzny
  password?: string;
  nav_prefs?: string[]; // skryté href-y v sidebar, prázdne = zobraziť všetko
  makler_id?: string | null;
  company_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  accounts: User[];
  login: (userId: string, password: string, turnstileToken?: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<void>;
  linkGoogleToCurrent: () => Promise<void>;
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
  linkGoogleToCurrent: async () => {},
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
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [checking, setChecking] = useState(true);

  async function loadAccounts() {
    const res = await fetch("/api/users", { credentials: "include" }).catch(() => null);
    if (!res?.ok) return [] as User[];
    const body = await res.json().catch(() => ({}));
    return (body.users ?? []) as User[];
  }

  // Helper: priradí Supabase session email k našemu `users` whitelist záznamu
  // Priorita: login_email (Gmail na prihlásenie) → email (fallback pre legacy)
  // Ak nájdený cez 'email' (ale login_email je prázdny), auto-uloží Gmail do login_email
  async function matchSessionToUser(email: string | null | undefined, accs: User[]): Promise<User | null> {
    if (!email) return null;
    const q = email.toLowerCase();
    const byLogin = accs.find(a => a.login_email?.toLowerCase() === q);
    if (byLogin) return byLogin;
    const byEmail = accs.find(a => a.email?.toLowerCase() === q);
    if (byEmail && !byEmail.login_email) {
      // Auto-naviaž Gmail na login_email
      await supabase.from("users").update({ login_email: email }).eq("id", byEmail.id);
      byEmail.login_email = email;
    }
    return byEmail || null;
  }

  useEffect(() => {
    // Jediný zdroj pravdy = localStorage.crm_user
    // Supabase session sa používa LEN na Google login flow (v callback page).
    // Žiadne onAuthStateChange — tie spôsobovali edge case logouty.
    const safetyTimeout = setTimeout(() => {
      console.warn("[auth] Safety timeout — forcing checking=false");
      setChecking(false);
    }, 2500);

    (async () => {
      try {
        const savedId = localStorage.getItem("crm_user");
        const accs = await loadAccounts().catch(() => [] as User[]);
        setAccounts(accs);

        if (savedId) {
          const found = accs.find(a => a.id === savedId);
          if (found) {
            // Najprv počkaj na bootstrap session cookie, potom setUser →
            // všetky deti komponenty odštartujú fetch volania až keď cookie existuje.
            // Ak bootstrap zlyhá, stále setUser → user vidí UI ale guard fetchy
            // budú 401 (lepšie ako stuck loading screen).
            try {
              const ctrl = new AbortController();
              const bsTimeout = setTimeout(() => ctrl.abort(), 1500);
              try {
                await fetch("/api/auth/session-bootstrap", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ user_id: found.id }),
                  signal: ctrl.signal,
                });
              } finally {
                clearTimeout(bsTimeout);
              }
            } catch (e) {
              console.warn("[auth] session-bootstrap failed:", e);
            }
            // Po bootstrap cookie máme session — reload accounts pre plné dáta (makler_id, company_id)
            const fullAccs = await loadAccounts().catch(() => accs);
            const fullFound = fullAccs.find(a => a.id === savedId) ?? found;
            setAccounts(fullAccs);
            setUser(fullFound);
          }
        }
      } catch (e) {
        console.error("[auth] initial load error:", e);
      } finally {
        clearTimeout(safetyTimeout);
        setChecking(false);
      }
    })();

    return () => { clearTimeout(safetyTimeout); };
  }, []);

  // Auto-logout po 30 min nečinnosti (mouse/key/touch/scroll).
  // 1 min pred vypršaním zobrazíme warning modal s tlačidlom "Zostať prihlásený".
  const [idleLogoutAt, setIdleLogoutAt] = useState<number | null>(null);
  useEffect(() => {
    if (!user) return;
    const IDLE_LIMIT_MS = 30 * 60 * 1000;
    const WARNING_BEFORE_MS = 60 * 1000;
    const KEY = "crm_last_activity";
    const bump = () => localStorage.setItem(KEY, String(Date.now()));
    bump();

    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const interval = setInterval(() => {
      const last = Number(localStorage.getItem(KEY) || "0");
      if (!last) return;
      const elapsed = Date.now() - last;
      if (elapsed > IDLE_LIMIT_MS) {
        localStorage.removeItem(KEY);
        localStorage.removeItem("crm_user");
        setIdleLogoutAt(null);
        setUser(null);
        supabase.auth.signOut().catch(() => {});
        if (typeof window !== "undefined") window.location.href = "/?logout=idle";
      } else if (elapsed > IDLE_LIMIT_MS - WARNING_BEFORE_MS) {
        setIdleLogoutAt(last + IDLE_LIMIT_MS);
      } else {
        setIdleLogoutAt(null);
      }
    }, 5_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(interval);
    };
  }, [user]);

  function stayLoggedIn() {
    localStorage.setItem("crm_last_activity", String(Date.now()));
    setIdleLogoutAt(null);
  }

  async function refreshAccounts() {
    const accs = await loadAccounts();
    setAccounts(accs);
  }

  async function login(identifier: string, password: string, turnstileToken?: string): Promise<string | null> {
    if (!identifier.trim()) return "Zadaj meno alebo email";

    // Cez server API — bcrypt hashovanie + rate limit + audit + HMAC session cookie
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // credentials: "include" — server set-cookie pre crm_session sa uchová
        credentials: "include",
        body: JSON.stringify({ identifier: identifier.trim(), password, turnstileToken }),
      });
      const body = await res.json();
      if (!res.ok) return body.error || "Prihlásenie zlyhalo";

      const acc = body.user as User;
      localStorage.setItem("crm_user", acc.id);
      setUser(acc);
      // Audit log
      fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: acc.id, action: "login", entity_type: "user", entity_id: acc.id }),
      }).catch(() => {});
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Chyba siete";
    }
  }

  async function loginWithGoogle(): Promise<void> {
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
  }

  /**
   * Prepoj Google účet k aktuálne prihlásenému userovi (napr. po hesla login).
   * Po Google OAuth návrate sa email uloží do users.login_email a session sa zahodí
   * (zostaneme prihlásený cez heslo, ale odvtedy vieme použiť aj Google).
   */
  async function linkGoogleToCurrent(): Promise<void> {
    if (!user?.id) return;
    localStorage.setItem("pending_link_user_id", user.id);
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
  }

  async function logout() {
    localStorage.removeItem("crm_user");
    // Vymaž server-side HMAC session cookie aj Supabase auth (Google OAuth)
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    await supabase.auth.signOut();
    setUser(null);
    if (typeof window !== "undefined") window.location.href = "/";
  }

  async function updateAccount(updated: User) {
    // Použi API endpoint (admin client) — users tabuľka bude chránená RLS
    await fetch(`/api/users?id=${encodeURIComponent(updated.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: updated.name,
        initials: updated.initials,
        role: updated.role,
        email: updated.email,
        login_email: updated.login_email || null,
        password: updated.password || "",
      }),
    });
    await refreshAccounts();
    if (user?.id === updated.id) setUser(updated);
  }

  async function addAccount(account: User) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: account.id,
        name: account.name,
        initials: account.initials,
        role: account.role,
        ...(account.email ? { email: account.email } : {}),
        ...(account.login_email ? { login_email: account.login_email } : {}),
        ...(account.password ? { password: account.password } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Chyba ${res.status}`);
    }
    await refreshAccounts();
  }

  async function deleteAccount(id: string) {
    await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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

  // Na /auth/callback, /reset-password a /registracia sa vždy zobrazí children (login bypass)
  const isAuthCallback = pathname?.startsWith("/auth/callback") || pathname?.startsWith("/reset-password") || pathname?.startsWith("/registracia");

  if (!user && !isAuthCallback) {
    return (
      <AuthContext.Provider value={{ user, accounts, login, loginWithGoogle, linkGoogleToCurrent, logout, updateAccount, addAccount, deleteAccount, refreshAccounts }}>
        <LoginScreen accounts={accounts} onLogin={login} onGoogleLogin={loginWithGoogle} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, accounts, login, loginWithGoogle, linkGoogleToCurrent, logout, updateAccount, addAccount, deleteAccount, refreshAccounts }}>
      {children}
      {idleLogoutAt !== null && <IdleWarningModal logoutAt={idleLogoutAt} onStay={stayLoggedIn} />}
    </AuthContext.Provider>
  );
}

function IdleWarningModal({ logoutAt, onStay }: { logoutAt: number; onStay: () => void }) {
  const [remaining, setRemaining] = useState(60);
  useEffect(() => {
    const tick = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((logoutAt - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(tick);
  }, [logoutAt]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div style={{
        background: "var(--bg-surface, #fff)", borderRadius: "20px", padding: "28px",
        maxWidth: "400px", width: "100%", textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        border: "1px solid var(--border, #E5E7EB)",
      }}>
        <div style={{ fontSize: "36px", marginBottom: "10px" }}>⏰</div>
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary, #111)", margin: "0 0 6px" }}>
          Ešte tam si?
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted, #6B7280)", margin: "0 0 18px", lineHeight: 1.5 }}>
          Z bezpečnostných dôvodov ťa o <strong style={{ color: "var(--text-primary, #111)" }}>{remaining}s</strong> automaticky odhlásime.
          Klikni aby si ostal prihlásený.
        </p>
        <button onClick={onStay} style={{
          width: "100%", padding: "12px", background: "#374151", color: "#fff",
          border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "600",
          cursor: "pointer",
        }}>Zostať prihlásený</button>
      </div>
    </div>
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

function LoginScreen({ accounts: _accounts, onLogin, onGoogleLogin }: { accounts: User[]; onLogin: (id: string, pw: string, token?: string) => Promise<string | null>; onGoogleLogin: () => Promise<void> }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileRef.current) return;
    const scriptId = "cf-turnstile-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    function tryRender() {
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
          "error-callback": () => setTurnstileToken(null),
          theme: "dark",
          size: "normal",
        });
      }
    }
    const poll = setInterval(tryRender, 200);
    tryRender();
    return () => {
      clearInterval(poll);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnstileSiteKey]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!identifier.trim()) { setError("Zadaj meno alebo email"); return; }
    setSubmitting(true);
    setError("");
    const err = await onLogin(identifier, password, turnstileToken ?? undefined);
    if (err) {
      setError(err);
      setSubmitting(false);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken(null);
      }
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    try {
      await onGoogleLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGoogleLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
      padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: "400px",
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
        borderRadius: "24px",
        border: "1px solid rgba(255,255,255,0.12)",
        padding: "36px 32px",
        boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
      }}>
        {/* Logo — Tier 1: Vianema dominates, AMGD whispers underneath */}
        <div style={{ textAlign: "center", marginBottom: "28px", color: "#fff" }}>
          <VianemaBranded />
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "16px 0 0" }}>
            Prihláste sa do systému
          </p>
        </div>

        {/* Formulár */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "6px", display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Meno alebo email
            </label>
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onInput={(e) => setIdentifier((e.target as HTMLInputElement).value)}
              disabled={submitting}
              placeholder="Meno alebo email"
              style={{
                width: "100%", padding: "13px 16px", borderRadius: "12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", fontSize: "14px", outline: "none",
                transition: "all 0.15s",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; }}
              onBlur={(e) => { setIdentifier(e.currentTarget.value); e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            />
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "6px", display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Heslo
            </label>
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              disabled={submitting}
              placeholder="••••••••"
              inverse
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 12px", borderRadius: "10px",
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fecaca", fontSize: "12px", fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {turnstileSiteKey && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div ref={turnstileRef} />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: "12px",
              background: "#fff", color: "#111827",
              border: "none", fontSize: "14px", fontWeight: 700,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.5 : 1,
              transition: "all 0.15s",
              marginTop: "4px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {submitting ? (
              <>
                <span style={{ width: "14px", height: "14px", border: "2px solid rgba(17,24,39,0.2)", borderTopColor: "#111827", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                Prihlasujem...
              </>
            ) : "Prihlásiť"}
          </button>

          {/* Zabudnuté heslo */}
          <div style={{ textAlign: "center", marginTop: "6px" }}>
            <button type="button" onClick={async () => {
              if (!identifier.trim()) { setError("Najprv zadaj meno alebo email"); return; }
              try {
                await fetch("/api/auth/forgot", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ identifier: identifier.trim() }),
                });
                setError("");
                alert("Ak existuje účet s týmto menom/emailom, poslali sme ti link na obnovenie hesla. Skontroluj si email (aj SPAM).");
              } catch { alert("Chyba pri odosielaní. Skús znova."); }
            }} style={{
              fontSize: "12px", color: "rgba(255,255,255,0.5)",
              background: "none", border: "none", cursor: "pointer",
              textDecoration: "underline", padding: "4px",
            }}>
              Zabudnuté heslo?
            </button>
          </div>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.12)" }} />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.04em" }}>ALEBO</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          style={{
            width: "100%", padding: "13px 16px", borderRadius: "12px",
            background: "rgba(255,255,255,0.06)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            fontSize: "14px", fontWeight: 600,
            cursor: googleLoading ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            transition: "all 0.15s",
            opacity: googleLoading ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { if (!googleLoading) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        >
          {googleLoading ? (
            <>
              <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
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
              Prihlásiť cez Google
            </>
          )}
        </button>

        {/* Registrácia */}
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
          Nemáte účet?{" "}
          <a href="/registracia" style={{ color: "rgba(255,255,255,0.65)", textDecoration: "underline" }}>
            Zaregistrujte kanceláriu
          </a>
        </p>

        {/* Footer — Tier 1: AMGD attribution under Vianema-branded screen */}
        <div style={{
          textAlign: "center", marginTop: "16px",
          color: "rgba(255,255,255,0.5)",
        }}>
          <PoweredByAMGD size="sm" />
          <div style={{
            fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "6px",
            letterSpacing: "0.02em",
          }}>
            v10.0
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export type { User };
