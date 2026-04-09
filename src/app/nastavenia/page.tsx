"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { User } from "@/components/AuthProvider";
import PhoneInput from "@/components/PhoneInput";
import { ALL_FEATURES, loadFeatureToggles, saveFeatureToggles } from "@/lib/featureToggles";
import type { FeatureId, FeatureToggles } from "@/lib/featureToggles";
import { getUserItem, setUserItem } from "@/lib/userStorage";

const DEFAULT_GOALS = { obrat: 5000, zmluvy: 10, nabery: 20 };

function loadGoals(userId?: string) {
  if (typeof window === "undefined" || !userId) return DEFAULT_GOALS;
  try {
    const raw = getUserItem(userId, "makler_goals");
    if (raw) return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_GOALS;
}

export default function NastaveniaPage() {
  const { user: authUser, accounts, updateAccount, addAccount, deleteAccount } = useAuth();
  const isAdmin = authUser?.id === "ales";
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [saved, setSaved] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("Maklér · Vianema");
  const [newUserPw, setNewUserPw] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email: string | null }>({ connected: false, email: null });
  const [googleLoading, setGoogleLoading] = useState(true);
  const [cenaM2, setCenaM2] = useState(2800);
  const [rekoM2, setRekoM2] = useState(500);
  const [marzaPct, setMarzaPct] = useState(15);
  const [cenoSaved, setCenoSaved] = useState(false);

  // Makler profile
  const [maklerMeno, setMaklerMeno] = useState("");
  const [maklerTelefon, setMaklerTelefon] = useState("");
  const [maklerEmail, setMaklerEmail] = useState("");
  const [maklerSaved, setMaklerSaved] = useState(false);

  // Vzorové inzeráty
  const [vzorLinks, setVzorLinks] = useState(["", "", ""]);
  const [vzorSaved, setVzorSaved] = useState(false);

  // Active category
  const [activeCategory, setActiveCategory] = useState("profil");

  const uid = authUser?.id || "";

  useEffect(() => {
    if (!uid) return;
    setGoals(loadGoals(uid));
    try {
      const cm = getUserItem(uid, "odhad_cena_m2");
      const rm = getUserItem(uid, "rekonstrukcia_m2");
      const mp = getUserItem(uid, "marza_percent");
      if (cm) setCenaM2(Number(cm));
      if (rm) setRekoM2(Number(rm));
      if (mp) setMarzaPct(Number(mp));

      // Load makler profile (per-user)
      const profile = getUserItem(uid, "makler_profile");
      if (profile) {
        const p = JSON.parse(profile);
        setMaklerMeno(p.meno || "");
        setMaklerTelefon(p.telefon || "");
        setMaklerEmail(p.email || "");
      } else if (authUser) {
        // Auto-fill from auth user for new accounts
        setMaklerMeno(authUser.name || "");
        setMaklerEmail(authUser.email || "");
      }

      // Load vzorové inzeráty (per-user)
      const vi = getUserItem(uid, "vzorove_inzeraty");
      if (vi) setVzorLinks(JSON.parse(vi));

      // Load feature toggles (global - admin manages all)
      setFeatureToggles(loadFeatureToggles());
    } catch { /* ignore */ }

    // Check Google connection status
    if (authUser?.id) {
      fetch(`/api/auth/google/status?userId=${authUser.id}`)
        .then(r => r.json())
        .then(d => setGoogleStatus(d))
        .finally(() => setGoogleLoading(false));
    } else {
      setGoogleLoading(false);
    }

    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    const googleResult = params.get("google");
    if (googleResult === "ok") {
      setGoogleStatus({ connected: true, email: null });
      if (authUser?.id) {
        fetch(`/api/auth/google/status?userId=${authUser.id}`)
          .then(r => r.json())
          .then(d => setGoogleStatus(d));
      }
      window.history.replaceState({}, "", "/nastavenia");
    }
  }, [authUser?.id, authUser?.name, authUser?.email]);

  function handleSaveCeny() {
    if (!uid) return;
    setUserItem(uid, "odhad_cena_m2", String(cenaM2));
    setUserItem(uid, "rekonstrukcia_m2", String(rekoM2));
    setUserItem(uid, "marza_percent", String(marzaPct));
    setCenoSaved(true);
    setTimeout(() => setCenoSaved(false), 2000);
  }

  function handleSaveMakler() {
    if (!uid) return;
    setUserItem(uid, "makler_profile", JSON.stringify({ meno: maklerMeno, telefon: maklerTelefon, email: maklerEmail }));
    setMaklerSaved(true);
    setTimeout(() => setMaklerSaved(false), 2000);
  }

  function handleSaveVzory() {
    if (!uid) return;
    setUserItem(uid, "vzorove_inzeraty", JSON.stringify(vzorLinks));
    setVzorSaved(true);
    setTimeout(() => setVzorSaved(false), 2000);
  }

  function handleConnectGoogle() {
    if (!authUser?.id) return;
    window.location.href = `/api/auth/google?userId=${authUser.id}`;
  }

  async function handleDisconnectGoogle() {
    if (!authUser?.id) return;
    await fetch("/api/auth/google/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: authUser.id }),
    });
    setGoogleStatus({ connected: false, email: null });
  }

  function handleSave() {
    if (!uid) return;
    setUserItem(uid, "makler_goals", JSON.stringify(goals));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.dispatchEvent(new Event("goals-updated"));
  }

  const cardSt: React.CSSProperties = {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "14px", padding: "24px",
  };
  const labelSt: React.CSSProperties = {
    fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "6px",
  };
  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
    color: "var(--text-primary)", outline: "none",
  };

  const categories = [
    { id: "profil", label: "Profil makléra", icon: "👤" },
    { id: "inzercia", label: "AI Inzercia", icon: "✍️" },
    { id: "ciele", label: "Ciele a kalkulácie", icon: "🎯" },
    { id: "integracie", label: "Integrácie", icon: "🔗" },
    { id: "faktury", label: "Faktúry", icon: "🧾", href: "/nastavenia/faktury" },
    ...(isAdmin ? [{ id: "ucty", label: "Účty", icon: "👥" }] : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Nastavenia</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>Prispôsobenie systému</p>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", overflowX: "auto", paddingBottom: "4px" }}>
        {categories.map(c => (
          <button key={c.id} onClick={() => {
            if ((c as { href?: string }).href) { window.location.href = (c as { href: string }).href; return; }
            setActiveCategory(c.id);
          }} style={{
            padding: "8px 16px", borderRadius: "10px", border: "1px solid var(--border)",
            background: activeCategory === c.id ? "#374151" : "var(--bg-surface)",
            color: activeCategory === c.id ? "#fff" : "var(--text-secondary)",
            fontSize: "13px", fontWeight: "600", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: "14px" }}>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* ═══ Profil makléra ═══ */}
      {activeCategory === "profil" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={cardSt}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>👤</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Profil makléra</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Kontaktné údaje pre inzeráty a komunikáciu</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }} className="goals-grid">
              <div>
                <div style={labelSt}>Meno a priezvisko</div>
                <input style={inputSt} value={maklerMeno} onChange={e => setMaklerMeno(e.target.value)} placeholder="Aleš Machovič" />
              </div>
              <div>
                <div style={labelSt}>Telefón</div>
                <PhoneInput value={maklerTelefon} onChange={setMaklerTelefon} placeholder="+421 9XX XXX XXX" />
              </div>
              <div>
                <div style={labelSt}>Email</div>
                <input type="email" style={inputSt} value={maklerEmail} onChange={e => setMaklerEmail(e.target.value)} placeholder="meno@vianema.eu" />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
              <button onClick={handleSaveMakler} style={{
                padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              }}>
                Uložiť profil
              </button>
              {maklerSaved && (
                <span style={{ fontSize: "13px", color: "#065F46", fontWeight: "500" }}>Uložené</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ AI Inzercia ═══ */}
      {activeCategory === "inzercia" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={cardSt}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, #F59E0B, #EF4444)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>✍️</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Vzorové inzeráty</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>AI sa bude držať štýlu týchto inzerátov</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {vzorLinks.map((link, i) => (
                <div key={i}>
                  <div style={labelSt}>Inzerát {i + 1}</div>
                  <input
                    style={inputSt}
                    value={link}
                    onChange={e => {
                      const next = [...vzorLinks];
                      next[i] = e.target.value;
                      setVzorLinks(next);
                    }}
                    placeholder="https://www.nehnutelnosti.sk/... alebo URL inzerátu"
                  />
                </div>
              ))}
            </div>

            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "12px", lineHeight: 1.5 }}>
              Vlož linky na tvoje najlepšie inzeráty. AI sa naučí tvoj štýl a bude generovať podobné texty.
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
              <button onClick={handleSaveVzory} style={{
                padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              }}>
                Uložiť vzory
              </button>
              {vzorSaved && (
                <span style={{ fontSize: "13px", color: "#065F46", fontWeight: "500" }}>Uložené</span>
              )}
            </div>
          </div>

          {/* Pravidlá inzercie - info card */}
          <div style={{ ...cardSt, background: "var(--bg-elevated)" }}>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "10px" }}>
              Pravidlá inzercie VIANEMA
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <div style={{ marginBottom: "6px" }}><strong>Nadpis:</strong> &quot;IBA U NÁS!&quot; / &quot;NA PREDAJ!&quot; / &quot;PRIPRAVUJEME...&quot;</div>
              <div style={{ marginBottom: "6px" }}><strong>Podnadpis:</strong> Vždy začína &quot;VIANEMA ponúka na predaj/nájom...&quot;</div>
              <div style={{ marginBottom: "6px" }}><strong>Baťovská cena:</strong> Predajné ceny končia na 900 alebo 99 900</div>
              <div><strong>Záver:</strong> Cena vrátane servisu + kontakt makléra + VIANEMA slogan</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Ciele a kalkulácie ═══ */}
      {activeCategory === "ciele" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Mesačné ciele */}
          <div style={cardSt}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, #FF3B30, #FF9500)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>🎯</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Mesačné ciele</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Nastav si ciele pre Apple Watch kruhy na dashboarde</div>
              </div>
            </div>

            <div className="goals-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <div style={labelSt}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#FF3B30", marginRight: "6px" }} />
                  Cieľ obratu (€)
                </div>
                <input type="number" style={inputSt} value={goals.obrat}
                  onChange={e => setGoals(g => ({ ...g, obrat: Number(e.target.value) || 0 }))}
                  min={0} step={500}
                />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Mesačná provízia v eurách</div>
              </div>
              <div>
                <div style={labelSt}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#34C759", marginRight: "6px" }} />
                  Cieľ zmlúv
                </div>
                <input type="number" style={inputSt} value={goals.zmluvy}
                  onChange={e => setGoals(g => ({ ...g, zmluvy: Number(e.target.value) || 0 }))}
                  min={0} step={1}
                />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Podpísané zmluvy za mesiac</div>
              </div>
              <div>
                <div style={labelSt}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#007AFF", marginRight: "6px" }} />
                  Cieľ náberov
                </div>
                <input type="number" style={inputSt} value={goals.nabery}
                  onChange={e => setGoals(g => ({ ...g, nabery: Number(e.target.value) || 0 }))}
                  min={0} step={1}
                />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Náberové listy za mesiac</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
              <button onClick={handleSave} style={{
                padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              }}>
                Uložiť ciele
              </button>
              {saved && <span style={{ fontSize: "13px", color: "#065F46", fontWeight: "500" }}>Uložené</span>}
            </div>
          </div>

          {/* Cenový odhad / Výkup */}
          <div style={cardSt}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, #10B981, #059669)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>📊</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Cenový odhad a výkup</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Predvolené hodnoty pre kalkuláciu v náberovom liste</div>
              </div>
            </div>

            <div className="goals-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <div style={labelSt}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#3B82F6", marginRight: "6px" }} />
                  Priem. cena za m² (€)
                </div>
                <input type="number" style={inputSt} value={cenaM2}
                  onChange={e => setCenaM2(Number(e.target.value) || 0)} min={0} step={100} />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Priemerná trhová cena v lokalite</div>
              </div>
              <div>
                <div style={labelSt}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B", marginRight: "6px" }} />
                  Rekonštrukcia za m² (€)
                </div>
                <input type="number" style={inputSt} value={rekoM2}
                  onChange={e => setRekoM2(Number(e.target.value) || 0)} min={0} step={50} />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Priemerná cena kompletnej reko</div>
              </div>
              <div>
                <div style={labelSt}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", marginRight: "6px" }} />
                  Marža (%)
                </div>
                <input type="number" style={inputSt} value={marzaPct}
                  onChange={e => setMarzaPct(Number(e.target.value) || 0)} min={0} max={50} step={1} />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Minimálny zisk na výkupe</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
              <button onClick={handleSaveCeny} style={{
                padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              }}>
                Uložiť ceny
              </button>
              {cenoSaved && <span style={{ fontSize: "13px", color: "#065F46", fontWeight: "500" }}>Uložené</span>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Integrácie ═══ */}
      {activeCategory === "integracie" && (
        <div style={cardSt}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "linear-gradient(135deg, #4285F4, #34A853)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px",
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Google integrácia</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Gmail, Kalendár a Google Disk</div>
            </div>
          </div>

          {googleLoading ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Kontrolujem prepojenie...
            </div>
          ) : googleStatus.connected ? (
            <div style={{
              padding: "20px", borderRadius: "12px",
              background: "#F0FDF4", border: "1px solid #BBF7D0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "#059669", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px",
                }}>&#10003;</div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#065F46" }}>Google účet pripojený</div>
                  <div style={{ fontSize: "12px", color: "#047857", marginTop: "2px" }}>{googleStatus.email || "Pripojený"}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                {[
                  { icon: "&#9993;", label: "Gmail", desc: "Emaily v systéme" },
                  { icon: "&#128197;", label: "Kalendár", desc: "Udalosti a obhliadky" },
                  { icon: "&#128193;", label: "Google Disk", desc: "Súbory a dokumenty" },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: "12px", borderRadius: "10px",
                    background: "rgba(255,255,255,0.7)", border: "1px solid #BBF7D0",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "20px", marginBottom: "4px" }} dangerouslySetInnerHTML={{ __html: s.icon }} />
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#065F46" }}>{s.label}</div>
                    <div style={{ fontSize: "10px", color: "#047857", marginTop: "2px" }}>{s.desc}</div>
                  </div>
                ))}
              </div>

              <button onClick={handleDisconnectGoogle} style={{
                padding: "8px 16px", background: "transparent", color: "#DC2626",
                border: "1px solid #FECACA", borderRadius: "8px",
                fontSize: "12px", fontWeight: "600", cursor: "pointer",
              }}>
                Odpojiť Google účet
              </button>
            </div>
          ) : (
            <div style={{
              padding: "24px", borderRadius: "12px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>
                <svg width="36" height="36" viewBox="0 0 48 48" style={{ verticalAlign: "middle" }}><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              </div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                Pripoj svoj Google účet
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px", lineHeight: 1.5 }}>
                Získaš prístup k Gmailu, Kalendáru a Google Disku priamo v CRM systéme.
              </div>

              <button onClick={handleConnectGoogle} style={{
                padding: "12px 32px", background: "#fff", color: "#374151",
                border: "1px solid #D1D5DB", borderRadius: "10px",
                fontSize: "14px", fontWeight: "600", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: "10px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Prihlásiť sa cez Google
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ Účty (admin only) ═══ */}
      {activeCategory === "ucty" && isAdmin && (
        <div style={cardSt}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px",
            }}>👥</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Účty</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Správa prihlasovacích účtov</div>
            </div>
            <button onClick={() => setShowAddUser(!showAddUser)} style={{
              padding: "6px 14px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>+ Nový účet</button>
          </div>

          {showAddUser && (
            <div style={{
              padding: "16px", borderRadius: "10px", background: "var(--bg-elevated)",
              border: "1px solid var(--border)", marginBottom: "16px",
            }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>Nový účet</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }} className="naber-grid">
                <div>
                  <div style={labelSt}>Meno a priezvisko</div>
                  <input style={inputSt} value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Meno Priezvisko" />
                </div>
                <div>
                  <div style={labelSt}>Email</div>
                  <input type="email" style={inputSt} value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="email@vianema.sk" />
                </div>
                <div>
                  <div style={labelSt}>Rola</div>
                  <select style={inputSt} value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                    <option value="Maklér · Vianema">Maklér</option>
                    <option value="Konateľ · Vianema">Konateľ</option>
                    <option value="Admin · Vianema">Admin</option>
                  </select>
                </div>
                <div>
                  <div style={labelSt}>Heslo (voliteľné)</div>
                  <input type="password" style={inputSt} value={newUserPw} onChange={e => setNewUserPw(e.target.value)} placeholder="Bez hesla = priamy prístup" />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button onClick={() => {
                  if (!newUserName.trim()) return;
                  const id = newUserName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                  const parts = newUserName.trim().split(" ");
                  const initials = `${(parts[0] || "")[0] || ""}${(parts[1] || "")[0] || ""}`.toUpperCase();
                  addAccount({ id, name: newUserName.trim(), initials, role: newUserRole, email: newUserEmail, password: newUserPw || "" });
                  setNewUserName(""); setNewUserEmail(""); setNewUserPw("");
                  setShowAddUser(false);
                }} style={{
                  padding: "8px 18px", background: "#374151", color: "#fff", border: "none",
                  borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
                }}>Vytvoriť</button>
                <button onClick={() => setShowAddUser(false)} style={{
                  padding: "8px 18px", background: "var(--bg-surface)", color: "var(--text-primary)",
                  border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
                }}>Zrušiť</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{
                borderRadius: "10px", background: "var(--bg-elevated)",
                border: "1px solid var(--border)", overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 14px",
                }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "50%",
                    background: "#374151", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", fontWeight: "700", flexShrink: 0,
                  }}>{acc.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
                      {acc.name} {acc.password ? "🔒" : ""}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {acc.email} · {acc.role}
                    </div>
                  </div>

                  {editingUser?.id === acc.id ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <input type="password" placeholder="Nové heslo" value={editingUser.password || ""}
                        onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                        style={{ ...inputSt, width: "140px", padding: "6px 10px", fontSize: "12px" }}
                      />
                      <button onClick={() => {
                        updateAccount(editingUser);
                        setEditingUser(null);
                        setAccountSaved(true);
                        setTimeout(() => setAccountSaved(false), 2000);
                      }} style={{
                        padding: "6px 12px", background: "#374151", color: "#fff", border: "none",
                        borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer",
                      }}>Uložiť</button>
                      <button onClick={() => setEditingUser(null)} style={{
                        padding: "6px 8px", background: "transparent", color: "var(--text-muted)",
                        border: "none", fontSize: "11px", cursor: "pointer",
                      }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "6px" }}>
                      {acc.id !== "ales" && (
                        <button onClick={() => setExpandedUser(expandedUser === acc.id ? null : acc.id)} style={{
                          padding: "5px 10px", background: expandedUser === acc.id ? "#374151" : "var(--bg-surface)",
                          color: expandedUser === acc.id ? "#fff" : "var(--text-secondary)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px", fontSize: "11px", cursor: "pointer",
                        }}>Funkcie</button>
                      )}
                      <button onClick={() => setEditingUser({ ...acc })} style={{
                        padding: "5px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                        borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "var(--text-secondary)",
                      }}>Heslo</button>
                      {acc.id !== "ales" && (
                        <button onClick={() => { if (confirm(`Odstrániť účet ${acc.name}?`)) deleteAccount(acc.id); }} style={{
                          padding: "5px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                          borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "#EF4444",
                        }}>Odstrániť</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Feature toggles panel */}
                {expandedUser === acc.id && acc.id !== "ales" && (
                  <div style={{
                    padding: "12px 14px", borderTop: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                  }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "10px" }}>
                      Povolené funkcie pre {acc.name}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }} className="naber-grid">
                      {ALL_FEATURES.map(feat => {
                        const enabled = featureToggles[acc.id]?.[feat.id] !== false;
                        return (
                          <button key={feat.id} onClick={() => {
                            const next = { ...featureToggles };
                            if (!next[acc.id]) {
                              next[acc.id] = {} as Record<FeatureId, boolean>;
                            }
                            next[acc.id][feat.id] = !enabled;
                            setFeatureToggles(next);
                            saveFeatureToggles(next);
                          }} style={{
                            display: "flex", alignItems: "center", gap: "8px",
                            padding: "8px 12px", borderRadius: "8px",
                            background: enabled ? "#F0FDF4" : "var(--bg-elevated)",
                            border: `1px solid ${enabled ? "#BBF7D0" : "var(--border)"}`,
                            cursor: "pointer", fontSize: "12px", fontWeight: "500",
                            color: enabled ? "#065F46" : "var(--text-muted)",
                            transition: "all 0.15s",
                          }}>
                            <div style={{
                              width: "32px", height: "18px", borderRadius: "9px",
                              background: enabled ? "#10B981" : "#D1D5DB",
                              position: "relative", transition: "background 0.2s", flexShrink: 0,
                            }}>
                              <div style={{
                                width: "14px", height: "14px", borderRadius: "50%",
                                background: "#fff", position: "absolute", top: "2px",
                                left: enabled ? "16px" : "2px",
                                transition: "left 0.2s",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                              }} />
                            </div>
                            {feat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {accountSaved && (
            <div style={{ fontSize: "13px", color: "#065F46", fontWeight: "500", marginTop: "12px" }}>
              Účet aktualizovaný
            </div>
          )}
        </div>
      )}
    </div>
  );
}
