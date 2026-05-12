"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { User } from "@/components/AuthProvider";
import PhoneInput from "@/components/PhoneInput";
import PasswordInput from "@/components/PasswordInput";
import { ALL_FEATURES, loadFeatureToggles, saveFeatureToggles } from "@/lib/featureToggles";
import { mainNavBase, operativaNav, systemNav } from "@/lib/navItems";
import type { FeatureId, FeatureToggles } from "@/lib/featureToggles";
import { getUserItem, setUserItem } from "@/lib/userStorage";
import { detectPushState, enableBrowserPush, type PushState } from "@/lib/pushClient";
import { BillingPanel } from "@/components/BillingPanel";
import type { PlanKey } from "@/lib/stripe-plans";

type NotifPrefs = { monitor: boolean; odklik: boolean; lv: boolean; naklady: boolean };
const DEFAULT_NOTIF_PREFS: NotifPrefs = { monitor: true, odklik: true, lv: true, naklady: true };
const NOTIF_TYPES: Array<{ key: keyof NotifPrefs; label: string; detail: string; icon: string }> = [
  { key: "monitor", label: "Nový súkromný inzerát", detail: "Monitor nájde nový byt/dom v tvojich filtroch", icon: "🏠" },
  { key: "odklik", label: "Odklik — auto-presun klienta", detail: "Klient nereagoval 24h a systém ho presunul", icon: "📥" },
  { key: "lv", label: "Pripomienka na LV", detail: "Dnes máš náber a ešte nemáš list vlastníctva", icon: "📋" },
  { key: "naklady", label: "Pravidelné náklady", detail: "Nový výdavok sa blíži k splatnosti", icon: "💰" },
];

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
  const [newUserLoginEmail, setNewUserLoginEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("Maklér · Vianema");
  const [newUserPw, setNewUserPw] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [inviteSentFor, setInviteSentFor] = useState<string | null>(null);
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkDone, setBulkDone] = useState<string[]>([]);
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

  // Spoločnosť (admin only)
  const [companyName, setCompanyName] = useState("Vianema s. r. o.");
  const [companySidlo, setCompanySidlo] = useState("");
  const [companyIco, setCompanyIco] = useState("");
  const [companyRegistracia, setCompanyRegistracia] = useState("");
  const [companySaved, setCompanySaved] = useState(false);

  // Billing
  const [billingPlan, setBillingPlan] = useState<PlanKey>("starter");
  const [billingActive, setBillingActive] = useState(true);
  const [billingHasCustomer, setBillingHasCustomer] = useState(false);

  // Active category
  const [activeCategory, setActiveCategory] = useState("profil");
  const [pushState, setPushState] = useState<PushState>("unknown");
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [notifSaved, setNotifSaved] = useState(false);
  const [navPrefs, setNavPrefs] = useState<string[]>([]);
  const [navPrefsSaved, setNavPrefsSaved] = useState(false);

  const uid = authUser?.id || "";

  // Notifikačné preferencie — load z DB a sleduj push state
  useEffect(() => {
    setPushState(detectPushState());
    if (!uid) return;
    fetch("/api/users").then(r => r.json()).then(({ users }) => {
      const userData = (users ?? []).find((u: { id: string; notification_prefs?: Partial<NotifPrefs>; nav_prefs?: string[] }) => u.id === uid);
      if (userData?.notification_prefs) setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...userData.notification_prefs });
      if (Array.isArray(userData?.nav_prefs)) setNavPrefs(userData.nav_prefs);
    });
  }, [uid]);

  const handleToggleNav = async (href: string) => {
    const next = navPrefs.includes(href)
      ? navPrefs.filter(h => h !== href)
      : [...navPrefs, href];
    setNavPrefs(next);
    await fetch(`/api/users?id=${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nav_prefs: next }),
    });
    setNavPrefsSaved(true);
    setTimeout(() => setNavPrefsSaved(false), 2000);
  };

  const handleToggleNotif = async (key: keyof NotifPrefs) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    await fetch(`/api/users?id=${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_prefs: next }),
    });
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2000);
  };

  const handleEnableBrowserPush = async () => {
    const res = await enableBrowserPush({ userId: uid });
    setPushState(res.state);
    if (res.error) alert(res.error);
  };

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

      // Load vzorové inzeráty z DB (cross-device). Fallback na localStorage pre legacy.
      fetch("/api/users").then(r => r.json()).then(({ users }) => {
        const userData = (users ?? []).find((u: { id: string; vzorove_inzeraty?: string[] }) => u.id === uid);
        const dbVal = userData?.vzorove_inzeraty;
        if (Array.isArray(dbVal) && dbVal.length > 0) {
          // Padding na 3 slots
          setVzorLinks([dbVal[0] || "", dbVal[1] || "", dbVal[2] || ""]);
        } else {
          // Migrácia z localStorage pri prvej návšteve po deploy
          const vi = getUserItem(uid, "vzorove_inzeraty");
          if (vi) setVzorLinks(JSON.parse(vi));
        }
      });

      // Load company info (admin only, from Supabase)
      if (isAdmin) {
        import("@/lib/supabase").then(({ supabase: sb }) => {
          sb.from("makleri").select("firma").eq("email", "ales@vianema.sk").single().then(({ data }) => {
            if (data?.firma) {
              try {
                const c = typeof data.firma === "string" ? JSON.parse(data.firma) : data.firma;
                if (c.nazov) setCompanyName(c.nazov);
                if (c.sidlo) setCompanySidlo(c.sidlo);
                if (c.ico) setCompanyIco(c.ico);
                if (c.registracia) setCompanyRegistracia(c.registracia);
              } catch { /* not JSON, legacy value */ }
            }
          });
        });
      }

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

    // Check URL params for OAuth callback result + billing tab
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

    const tab = params.get("tab");
    if (tab === "billing") {
      setActiveCategory("billing");
    }
  }, [authUser?.id, authUser?.name, authUser?.email]);

  // Načítaj billing info pre aktívnu firmu
  useEffect(() => {
    if (activeCategory !== "billing") return;
    fetch("/api/billing/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setBillingPlan((d.plan as PlanKey) || "starter");
        setBillingActive(d.is_active !== false);
        setBillingHasCustomer(!!d.stripe_customer_id);
      })
      .catch(() => {});
  }, [activeCategory]);

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

  async function handleSaveVzory() {
    if (!uid) return;
    // Filter out empty slots pred uložením do DB
    const nonEmpty = vzorLinks.filter((l) => l && l.trim());
    await fetch(`/api/users?id=${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vzorove_inzeraty: nonEmpty }),
    });
    // Zachovaj aj localStorage pre spätnú kompatibilitu
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

  async function handleSaveCompany() {
    try {
      const { supabase: sb } = await import("@/lib/supabase");
      const companyData = JSON.stringify({
        nazov: companyName, sidlo: companySidlo, ico: companyIco, registracia: companyRegistracia,
      });
      await sb.from("makleri").update({ firma: companyData }).eq("email", "ales@vianema.sk");
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 2000);
    } catch { /* ignore */ }
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
    { id: "notifikacie", label: "Notifikácie", icon: "🔔" },
    { id: "inzercia", label: "AI Inzercia", icon: "✍️" },
    { id: "ciele", label: "Ciele a kalkulácie", icon: "🎯" },
    { id: "integracie", label: "Integrácie", icon: "🔗" },
    { id: "menu", label: "Menu", icon: "☰" },
    { id: "faktury", label: "Faktúry", icon: "🧾", href: "/nastavenia/faktury" },
    ...(isAdmin ? [
      { id: "spolocnost", label: "Spoločnosť", icon: "🏢" },
      { id: "ucty", label: "Účty", icon: "👥" },
      { id: "billing", label: "Predplatné", icon: "💳" },
    ] : []),
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

      {/* ═══ Notifikácie ═══ */}
      {activeCategory === "notifikacie" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={cardSt}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, #F59E0B, #EF4444)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px",
              }}>🔔</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Push notifikácie</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Automatické udalosti posielané na plochu / mobil</div>
              </div>
            </div>

            {/* Browser push toggle */}
            <div style={{
              padding: "14px 16px", marginBottom: "20px",
              borderRadius: "10px",
              background: pushState === "granted" ? "#ECFDF5" : pushState === "denied" ? "#FEF2F2" : "var(--bg-elevated)",
              border: `1px solid ${pushState === "granted" ? "#A7F3D0" : pushState === "denied" ? "#FECACA" : "var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
            }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
                  {pushState === "granted" ? "✓ Tento prehliadač je povolený" :
                   pushState === "denied" ? "⚠ Notifikácie sú zablokované v prehliadači" :
                   pushState === "unsupported" ? "Prehliadač nepodporuje notifikácie" :
                   "Notifikácie v prehliadači nie sú aktívne"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {pushState === "denied" ?
                    "Povoľ ich v nastaveniach prehliadača → notifikácie pre crmvianema.vercel.app" :
                    "Prehliadač ti pop-upne okienko s novou udalosťou aj keď máš Chrome zatvorený"}
                </div>
              </div>
              {pushState !== "granted" && pushState !== "unsupported" && (
                <button onClick={handleEnableBrowserPush} style={{
                  padding: "10px 18px", background: "#374151", color: "#fff", border: "none",
                  borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>
                  Povoliť na tomto zariadení
                </button>
              )}
            </div>

            {/* Typy notifikácií */}
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "10px" }}>
              Ktoré udalosti chceš dostávať
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {NOTIF_TYPES.map((t) => {
                const enabled = notifPrefs[t.key];
                return (
                  <label key={t.key} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: enabled ? "var(--bg-elevated)" : "var(--bg-surface)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggleNotif(t.key)}
                      style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#374151" }}
                    />
                    <span style={{ fontSize: "18px" }}>{t.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{t.label}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.detail}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {notifSaved && (
              <div style={{ marginTop: "12px", fontSize: "12px", color: "#059669", fontWeight: "500" }}>
                ✓ Uložené
              </div>
            )}
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

          {/* Cenový odhad / Výkup — len admin */}
          {isAdmin && (
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
          )}
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

      {/* ═══ Prispôsobenie menu ═══ */}
      {activeCategory === "menu" && (
        <div style={cardSt}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "linear-gradient(135deg, #374151, #6B7280)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px", color: "#fff",
            }}>☰</div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Prispôsobenie menu</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Vyber čo chceš vidieť v ľavom menu</div>
            </div>
          </div>

          {[
            { label: "HLAVNÉ", items: mainNavBase },
            { label: "ADMINISTRATÍVA", items: operativaNav },
            { label: "SYSTÉM", items: systemNav },
          ].map(section => (
            <div key={section.label} style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.03em", marginBottom: "8px" }}>
                {section.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {section.items.map(item => {
                  const visible = !navPrefs.includes(item.href);
                  return (
                    <label key={item.href} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 14px", borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: visible ? "var(--bg-elevated)" : "var(--bg-surface)",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => handleToggleNav(item.href)}
                        style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#374151" }}
                      />
                      <span style={{ fontSize: "14px" }}>{item.icon}</span>
                      <span style={{ fontSize: "13px", fontWeight: "500", color: visible ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {item.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {navPrefsSaved && (
            <div style={{ fontSize: "12px", color: "#059669", fontWeight: "500" }}>✓ Uložené</div>
          )}
        </div>
      )}

      {/* ═══ Spoločnosť (admin only) ═══ */}
      {activeCategory === "spolocnost" && isAdmin && (
        <div style={cardSt}>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
            🏢 Info o spoločnosti
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 20px" }}>
            Fakturačné údaje spoločnosti — zobrazujú sa v náberovom liste a dokumentoch
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={labelSt}>Názov spoločnosti</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} style={inputSt}
                placeholder="napr. Vianema s. r. o." />
            </div>
            <div>
              <label style={labelSt}>Sídlo</label>
              <input value={companySidlo} onChange={e => setCompanySidlo(e.target.value)} style={inputSt}
                placeholder="napr. Karpatské námestie 10A, 831 06 Bratislava – mestská časť Rača" />
            </div>
            <div>
              <label style={labelSt}>IČO</label>
              <input value={companyIco} onChange={e => setCompanyIco(e.target.value)} style={inputSt}
                placeholder="napr. 47 395 095" />
            </div>
            <div>
              <label style={labelSt}>Registrácia</label>
              <textarea value={companyRegistracia} onChange={e => setCompanyRegistracia(e.target.value)}
                rows={2} style={{ ...inputSt, resize: "vertical" }}
                placeholder='napr. zapísaná v OR MS Bratislava III, oddiel: Sro, vložka č.: 123596/B' />
            </div>
          </div>
          <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={handleSaveCompany} style={{
              padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>Uložiť</button>
            {companySaved && <span style={{ fontSize: "13px", color: "#059669", fontWeight: "600" }}>✓ Uložené</span>}
          </div>
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
                  <div style={labelSt}>Vianema email</div>
                  <input type="email" style={inputSt} value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="meno@vianema.eu" />
                </div>
                <div>
                  <div style={labelSt}>Gmail pre prihlásenie (Google OAuth)</div>
                  <input type="email" style={inputSt} value={newUserLoginEmail} onChange={e => setNewUserLoginEmail(e.target.value)} placeholder="meno.priezvisko@gmail.com" />
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
                  <PasswordInput
                    autoComplete="new-password"
                    value={newUserPw} onChange={e => setNewUserPw(e.target.value)}
                    placeholder="Bez hesla = priamy prístup"
                    style={inputSt as React.CSSProperties}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button onClick={() => {
                  if (!newUserName.trim()) return;
                  const id = newUserName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                  const parts = newUserName.trim().split(" ");
                  const initials = `${(parts[0] || "")[0] || ""}${(parts[1] || "")[0] || ""}`.toUpperCase();
                  addAccount({ id, name: newUserName.trim(), initials, role: newUserRole, email: newUserEmail, login_email: newUserLoginEmail || undefined, password: newUserPw || "" });
                  setNewUserName(""); setNewUserEmail(""); setNewUserLoginEmail(""); setNewUserPw("");
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

          {/* Bulk invite toolbar */}
          {selectedInvites.size > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", marginBottom: "8px", borderRadius: "10px",
              background: "#EFF6FF", border: "1px solid #BFDBFE",
            }}>
              <span style={{ fontSize: "13px", color: "#1D4ED8", fontWeight: 600 }}>
                {selectedInvites.size} {selectedInvites.size === 1 ? "maklér vybraný" : "makléri vybraní"}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setSelectedInvites(new Set())} style={{
                  padding: "5px 10px", background: "transparent", border: "1px solid #BFDBFE",
                  borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "#1D4ED8",
                }}>Zrušiť výber</button>
                <button
                  disabled={bulkSending}
                  onClick={async () => {
                    setBulkSending(true);
                    setBulkDone([]);
                    const ids = Array.from(selectedInvites);
                    const results = await Promise.all(ids.map(id =>
                      fetch("/api/users/invite", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: id }),
                      }).then(r => ({ id, ok: r.ok })).catch(() => ({ id, ok: false }))
                    ));
                    const sent = results.filter(r => r.ok).map(r => r.id);
                    const failed = results.filter(r => !r.ok);
                    setBulkDone(sent);
                    setBulkSending(false);
                    setSelectedInvites(new Set());
                    if (failed.length > 0) alert(`${failed.length} pozvánok sa nepodarilo odoslať.`);
                    setTimeout(() => setBulkDone([]), 5000);
                  }}
                  style={{
                    padding: "5px 14px", background: bulkSending ? "#93C5FD" : "#2563EB",
                    border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                    cursor: bulkSending ? "not-allowed" : "pointer", color: "#fff",
                  }}
                >
                  {bulkSending ? "Odosielam…" : `✉ Poslať ${selectedInvites.size} pozvánok`}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{
                borderRadius: "10px", overflow: "hidden",
                background: bulkDone.includes(acc.id) ? "#F0FDF4" : "var(--bg-elevated)",
                border: `1px solid ${bulkDone.includes(acc.id) ? "#86EFAC" : "var(--border)"}`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 14px",
                }}>
                  {acc.id !== "ales" && (
                    <input
                      type="checkbox"
                      checked={selectedInvites.has(acc.id)}
                      onChange={e => {
                        const next = new Set(selectedInvites);
                        e.target.checked ? next.add(acc.id) : next.delete(acc.id);
                        setSelectedInvites(next);
                      }}
                      style={{ width: "15px", height: "15px", accentColor: "#2563EB", flexShrink: 0, cursor: "pointer" }}
                    />
                  )}
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
                    {acc.login_email && (
                      <div style={{ fontSize: "11px", color: "#3B82F6", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span>G</span> {acc.login_email}
                      </div>
                    )}
                  </div>

                  {editingUser?.id === acc.id ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <input type="email" placeholder="Gmail pre Google login" value={editingUser.login_email || ""}
                        onChange={e => setEditingUser({ ...editingUser, login_email: e.target.value })}
                        style={{ ...inputSt, width: "200px", padding: "6px 10px", fontSize: "12px" }}
                      />
                      <div style={{ width: "180px" }}>
                        <PasswordInput
                          autoComplete="new-password"
                          placeholder="Nové heslo"
                          value={editingUser.password || ""}
                          onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                          style={{ ...inputSt, padding: "6px 32px 6px 10px", fontSize: "12px" } as React.CSSProperties}
                        />
                      </div>
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
                        <button onClick={async () => {
                          if (inviteSending) return;
                          setInviteSending(acc.id);
                          setInviteSentFor(null);
                          try {
                            const res = await fetch("/api/users/invite", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ user_id: acc.id }),
                            });
                            const body = await res.json();
                            if (!res.ok) { alert("Chyba: " + (body.error || "neznáma")); return; }
                            setInviteSentFor(acc.id);
                            setTimeout(() => setInviteSentFor(null), 4000);
                          } catch (e) { alert("Chyba: " + (e instanceof Error ? e.message : e)); }
                          finally { setInviteSending(null); }
                        }} style={{
                          padding: "5px 10px",
                          background: inviteSentFor === acc.id ? "#D1FAE5" : "var(--bg-surface)",
                          border: `1px solid ${inviteSentFor === acc.id ? "#6EE7B7" : "var(--border)"}`,
                          borderRadius: "6px", fontSize: "11px", cursor: "pointer",
                          color: inviteSentFor === acc.id ? "#065F46" : "var(--text-secondary)",
                          opacity: inviteSending === acc.id ? 0.6 : 1,
                        }}>
                          {inviteSending === acc.id ? "…" : inviteSentFor === acc.id ? "✓ Odoslané" : "✉ Pozvánka"}
                        </button>
                      )}
                      {acc.id !== "ales" && (
                        <button onClick={async () => {
                          if (!confirm(`Resetovať heslo pre ${acc.name}? Vygeneruje sa dočasné heslo ktoré môžeš poslať maklerovi.`)) return;
                          try {
                            const res = await fetch("/api/users/reset-password", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ user_id: acc.id }),
                            });
                            const body = await res.json();
                            if (!res.ok) { alert("Chyba: " + (body.error || "neznáma")); return; }
                            // Skopíruj do clipboardu + zobraz
                            try { await navigator.clipboard.writeText(body.temp_password); } catch { /* ignore */ }
                            alert(`✅ Heslo resetované pre ${acc.name}\n\nDočasné heslo (skopírované do schránky):\n\n${body.temp_password}\n\nPošli ho maklerovi bezpečným kanálom (SMS / osobne).`);
                          } catch (e) { alert("Chyba: " + (e instanceof Error ? e.message : e)); }
                        }} style={{
                          padding: "5px 10px", background: "#FEF3C7", border: "1px solid #FDE68A",
                          borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "#92400E",
                        }}>🔑 Reset</button>
                      )}
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

      {activeCategory === "billing" && isAdmin && (
        <div style={cardSt}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Predplatné</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Spravujte plán a platobné údaje vašej kancelárie.
            </p>
          </div>
          <BillingPanel
            currentPlan={billingPlan}
            isSuspended={!billingActive}
            hasStripeCustomer={billingHasCustomer}
          />
        </div>
      )}
    </div>
  );
}
