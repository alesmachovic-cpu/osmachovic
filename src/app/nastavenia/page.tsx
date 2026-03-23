"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { User } from "@/components/AuthProvider";

const DEFAULT_GOALS = { obrat: 5000, zmluvy: 10, nabery: 20 };

function loadGoals() {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = localStorage.getItem("makler_goals");
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
  const [gmail, setGmail] = useState("");
  const [calToken, setCalToken] = useState("");
  const [googleSaved, setGoogleSaved] = useState(false);
  const [cenaM2, setCenaM2] = useState(2800);
  const [rekoM2, setRekoM2] = useState(500);
  const [marzaPct, setMarzaPct] = useState(15);
  const [cenoSaved, setCenoSaved] = useState(false);

  useEffect(() => {
    setGoals(loadGoals());
    try {
      const g = localStorage.getItem("google_gmail");
      const t = localStorage.getItem("google_cal_token");
      if (g) setGmail(g);
      if (t) setCalToken(t);
      const cm = localStorage.getItem("odhad_cena_m2");
      const rm = localStorage.getItem("rekonstrukcia_m2");
      const mp = localStorage.getItem("marza_percent");
      if (cm) setCenaM2(Number(cm));
      if (rm) setRekoM2(Number(rm));
      if (mp) setMarzaPct(Number(mp));
    } catch { /* ignore */ }
  }, []);

  function handleSaveCeny() {
    localStorage.setItem("odhad_cena_m2", String(cenaM2));
    localStorage.setItem("rekonstrukcia_m2", String(rekoM2));
    localStorage.setItem("marza_percent", String(marzaPct));
    setCenoSaved(true);
    setTimeout(() => setCenoSaved(false), 2000);
  }

  function handleSaveGoogle() {
    localStorage.setItem("google_gmail", gmail);
    localStorage.setItem("google_cal_token", calToken);
    setGoogleSaved(true);
    setTimeout(() => setGoogleSaved(false), 2000);
  }

  function handleSave() {
    localStorage.setItem("makler_goals", JSON.stringify(goals));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Dispatch event so dashboard can pick up changes
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

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Nastavenia</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>Prispôsobenie systému</p>
      </div>

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
          {/* Obrat */}
          <div>
            <div style={labelSt}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#FF3B30", marginRight: "6px" }} />
              Cieľ obratu (€)
            </div>
            <input
              type="number" style={inputSt} value={goals.obrat}
              onChange={e => setGoals(g => ({ ...g, obrat: Number(e.target.value) || 0 }))}
              min={0} step={500}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Mesačná provízia v eurách
            </div>
          </div>

          {/* Zmluvy */}
          <div>
            <div style={labelSt}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#34C759", marginRight: "6px" }} />
              Cieľ zmlúv
            </div>
            <input
              type="number" style={inputSt} value={goals.zmluvy}
              onChange={e => setGoals(g => ({ ...g, zmluvy: Number(e.target.value) || 0 }))}
              min={0} step={1}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Podpísané zmluvy za mesiac
            </div>
          </div>

          {/* Nábery */}
          <div>
            <div style={labelSt}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#007AFF", marginRight: "6px" }} />
              Cieľ náberov
            </div>
            <input
              type="number" style={inputSt} value={goals.nabery}
              onChange={e => setGoals(g => ({ ...g, nabery: Number(e.target.value) || 0 }))}
              min={0} step={1}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Náberové listy za mesiac
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <button onClick={handleSave} style={{
            padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
            borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
          }}>
            Uložiť ciele
          </button>
          {saved && (
            <span style={{ fontSize: "13px", color: "#065F46", fontWeight: "500" }}>
              Uložené
            </span>
          )}
        </div>
      </div>
      {/* Cenový odhad / Výkup */}
      <div style={{ ...cardSt, marginTop: "20px" }}>
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
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Priemerná trhová cena v lokalite
            </div>
          </div>
          <div>
            <div style={labelSt}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B", marginRight: "6px" }} />
              Rekonštrukcia za m² (€)
            </div>
            <input type="number" style={inputSt} value={rekoM2}
              onChange={e => setRekoM2(Number(e.target.value) || 0)} min={0} step={50} />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Priemerná cena kompletnej reko
            </div>
          </div>
          <div>
            <div style={labelSt}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", marginRight: "6px" }} />
              Marža (%)
            </div>
            <input type="number" style={inputSt} value={marzaPct}
              onChange={e => setMarzaPct(Number(e.target.value) || 0)} min={0} max={50} step={1} />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Minimálny zisk na výkupe
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <button onClick={handleSaveCeny} style={{
            padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
            borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
          }}>
            Uložiť ceny
          </button>
          {cenoSaved && (
            <span style={{ fontSize: "13px", color: "#065F46", fontWeight: "500" }}>
              Uložené
            </span>
          )}
        </div>
      </div>

      {/* Účty — len pre admin (ales) */}
      {isAdmin && <>{/* Účty */}
      <div style={{ ...cardSt, marginTop: "20px" }}>
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

        {/* Pridanie nového účtu */}
        {showAddUser && (
          <div style={{
            padding: "16px", borderRadius: "10px", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", marginBottom: "16px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>
              Nový účet
            </div>
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

        {/* Zoznam účtov */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "12px 14px", borderRadius: "10px", background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
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
          ))}
        </div>
        {accountSaved && (
          <div style={{ fontSize: "13px", color: "#065F46", fontWeight: "500", marginTop: "12px" }}>
            Účet aktualizovaný
          </div>
        )}
      </div>

      </>}

      {/* Google Calendar / Gmail */}
      <div style={{ ...cardSt, marginTop: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: "linear-gradient(135deg, #4285F4, #34A853)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>📅</div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Google integrácia</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Kalendár a Gmail pre automatické plánovanie</div>
          </div>
        </div>

        {/* Gmail */}
        <div style={{ marginBottom: "16px" }}>
          <div style={labelSt}>Gmail účet</div>
          <input
            type="email" style={inputSt} placeholder="tvoj@gmail.com"
            value={gmail} onChange={e => setGmail(e.target.value)}
          />
        </div>

        {/* Jednoduché prepojenie */}
        <div style={{
          padding: "16px", borderRadius: "12px",
          background: gmail ? "#F0FDF4" : "var(--bg-elevated)",
          border: gmail ? "1px solid #BBF7D0" : "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>{gmail ? "✅" : "📅"}</span>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: gmail ? "#065F46" : "var(--text-primary)" }}>
                {gmail ? `Pripojený: ${gmail}` : "Pripoj Google účet"}
              </div>
              <div style={{ fontSize: "11px", color: gmail ? "#047857" : "var(--text-muted)", marginTop: "2px" }}>
                {gmail ? "Obhliadky a stretnutia sa zobrazia v kalendári" : "Automaticky naplánuj obhliadky a stretnutia"}
              </div>
            </div>
          </div>

          {!gmail && (
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Zadaj Gmail adresu a systém ti bude automaticky pridávať obhliadky do Google Calendar.
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <button onClick={handleSaveGoogle} style={{
            padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
            borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
          }}>
            Uložiť
          </button>
          {googleSaved && (
            <span style={{ fontSize: "13px", color: "#065F46", fontWeight: "500" }}>
              Uložené
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
