"use client";

import { useEffect, useState } from "react";

type SetupData = {
  secret: string;
  otpauth_uri: string;
  manual_key_groups: string[];
  issuer: string;
  account: string;
};

type Status = "idle" | "setup" | "verifying" | "enabled" | "disabling";

export default function SecuritySettingsPage() {
  const [is2faEnabled, setIs2faEnabled] = useState<boolean | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  useEffect(() => { void loadStatus(); }, []);

  async function loadStatus() {
    try {
      const res = await fetch("/api/auth/me");
      const j = await res.json();
      setIs2faEnabled(!!j.user?.totp_enabled_at);
    } catch {
      setIs2faEnabled(false);
    }
  }

  async function startSetup() {
    setError(null);
    setStatus("setup");
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Setup zlyhal"); setStatus("idle"); return; }
      setSetupData(j);
      // Render QR ako data URL cez `qrcode` library cez dynamic import.
      const qr = await import("qrcode");
      const svg = await qr.toString(j.otpauth_uri, { type: "svg", width: 220, margin: 1 });
      setQrSvg(svg);
    } catch (e) {
      setError(String(e));
      setStatus("idle");
    }
  }

  async function verifyAndEnable() {
    if (!/^\d{6}$/.test(code)) { setError("Zadaj 6-cifrový kód"); return; }
    setError(null);
    setStatus("verifying");
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Overenie zlyhalo"); setStatus("setup"); return; }
      setBackupCodes(j.backup_codes);
      setStatus("enabled");
      setIs2faEnabled(true);
      setSetupData(null);
      setQrSvg("");
    } catch (e) {
      setError(String(e));
      setStatus("setup");
    }
  }

  async function disable2fa() {
    setError(null);
    setStatus("disabling");
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Vypnutie zlyhalo"); setStatus("idle"); return; }
      setIs2faEnabled(false);
      setBackupCodes(null);
      setDisablePassword("");
      setDisableCode("");
      setStatus("idle");
    } catch (e) {
      setError(String(e));
      setStatus("idle");
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 0" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Bezpečnosť</h1>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 28 }}>Dvojfaktorové overenie (2FA) — RFC 6238 TOTP</div>

      <div style={{ background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.05)" }}>
        {is2faEnabled === null && <div style={{ color: "#9ca3af" }}>Načítavam…</div>}

        {is2faEnabled === false && status === "idle" && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>2FA nie je zapnuté</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
              Pridaj druhú vrstvu ochrany. Po zapnutí budeš pri každom prihlásení potrebovať 6-cifrový kód z aplikácie ako Google Authenticator, Authy, 1Password alebo Bitwarden.
            </p>
            <button onClick={startSetup} style={{ background: "#374151", color: "#fff", padding: "10px 18px", borderRadius: 10, border: 0, fontWeight: 600, cursor: "pointer" }}>
              Zapnúť 2FA
            </button>
          </>
        )}

        {is2faEnabled === false && status === "setup" && setupData && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>1. Nasnímaj QR alebo zadaj kľúč ručne</h2>
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} style={{ background: "#fff", padding: 4 }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Manual key (ak QR nefunguje):</div>
                <code style={{ display: "block", fontSize: 14, fontFamily: "ui-monospace, monospace", background: "#F5F5F7", padding: "10px 12px", borderRadius: 8, wordBreak: "break-all" }}>
                  {setupData.manual_key_groups.join(" ")}
                </code>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{setupData.issuer} · {setupData.account}</div>
              </div>
            </div>

            <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>2. Zadaj 6-cifrový kód z aplikácie</h2>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              style={{ fontSize: 22, fontFamily: "ui-monospace, monospace", padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", width: 180, letterSpacing: "0.2em", textAlign: "center" }}
            />
            {error && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>{error}</div>}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button onClick={verifyAndEnable} disabled={code.length !== 6} style={{ background: "#374151", color: "#fff", padding: "10px 18px", borderRadius: 10, border: 0, fontWeight: 600, cursor: code.length === 6 ? "pointer" : "not-allowed", opacity: code.length === 6 ? 1 : 0.5 }}>
                Overiť a zapnúť
              </button>
              <button onClick={() => { setStatus("idle"); setSetupData(null); setError(null); setCode(""); }} style={{ background: "transparent", color: "#374151", padding: "10px 18px", borderRadius: 10, border: "1px solid #e5e7eb", cursor: "pointer" }}>
                Zrušiť
              </button>
            </div>
          </>
        )}

        {status === "enabled" && backupCodes && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: "#059669" }}>2FA je teraz zapnuté ✓</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 1.6 }}>
              <strong>Ulož tieto backup kódy.</strong> Každý funguje raz. Použiješ ich ak stratíš telefón. Po zatvorení tejto stránky ich už neuvidíš.
            </p>
            <div style={{ background: "#FFF8E1", border: "1px solid #FCD34D", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontFamily: "ui-monospace, monospace", fontSize: 14 }}>
                {backupCodes.map((c) => <div key={c}>{c}</div>)}
              </div>
            </div>
            <button onClick={() => { setBackupCodes(null); setStatus("idle"); }} style={{ background: "#374151", color: "#fff", padding: "10px 18px", borderRadius: 10, border: 0, fontWeight: 600, cursor: "pointer" }}>
              Mám uložené, pokračovať
            </button>
          </>
        )}

        {is2faEnabled === true && status !== "enabled" && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: "#059669" }}>2FA je zapnuté ✓</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
              Pri každom prihlásení budeš potrebovať kód z aplikácie.
            </p>
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 13, color: "#b91c1c", cursor: "pointer" }}>Vypnúť 2FA</summary>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}>
                <input
                  type="password"
                  placeholder="Tvoje heslo"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb" }}
                />
                <input
                  placeholder="alebo TOTP / backup kód"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb" }}
                />
                {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
                <button onClick={disable2fa} disabled={status === "disabling"} style={{ background: "#b91c1c", color: "#fff", padding: "10px 18px", borderRadius: 10, border: 0, fontWeight: 600, cursor: "pointer" }}>
                  {status === "disabling" ? "Vypínam…" : "Vypnúť 2FA"}
                </button>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
