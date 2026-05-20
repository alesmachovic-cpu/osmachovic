"use client";

import { useState, useEffect, useRef } from "react";

/**
 * ReAuthModal — modálny dialog ktorý vyžiada password ALEBO TOTP/backup code
 * pred sensitive akciou.
 *
 * 🔒 PEN-TEST M1 UI (2026-05-20):
 *   Backend endpointy (gdpr/erasure, klienti DELETE, obchody status,
 *   users PATCH role) vracajú 403 RE_AUTH_REQUIRED ak chýba confirm.
 *   Tento modal volá akciu so správnym potvrdením.
 *
 * Použitie:
 *   const reAuth = useReAuthModal();
 *   ...
 *   const confirmed = await reAuth.prompt({
 *     title: "Vymazať klienta",
 *     description: "Táto akcia je nezvratná. Zadaj svoje heslo.",
 *     dangerLabel: "Vymazať",
 *   });
 *   if (!confirmed) return; // user zrušil
 *   await fetch("/api/...", {
 *     body: JSON.stringify({ ...payload, ...confirmed }),  // confirm_password / confirm_code
 *   });
 */

export type ReAuthPayload = {
  confirm_password?: string;
  confirm_code?: string;
};

type PromptOptions = {
  title: string;
  description: string;
  dangerLabel?: string;  // text tlačidla potvrdenia (default "Potvrdiť")
};

type ModalState = {
  open: boolean;
  options: PromptOptions | null;
  resolve: ((payload: ReAuthPayload | null) => void) | null;
};

// Module-level singleton pre globálnu inštanciu modalu.
// Komponent <ReAuthModalHost /> v root layout sa naň prihlasuje.
let globalResolve: ((payload: ReAuthPayload | null) => void) | null = null;
let globalSetState: ((s: ModalState) => void) | null = null;

export function useReAuth() {
  return {
    prompt: (options: PromptOptions): Promise<ReAuthPayload | null> => {
      return new Promise((resolve) => {
        if (!globalSetState) {
          console.error("[ReAuth] <ReAuthModalHost /> nie je mounted v root layout");
          resolve(null);
          return;
        }
        globalResolve = resolve;
        globalSetState({ open: true, options, resolve });
      });
    },
  };
}

/** Host komponent — pridať do root layout. Renderuje sa raz. */
export default function ReAuthModalHost() {
  const [state, setState] = useState<ModalState>({ open: false, options: null, resolve: null });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<"password" | "code">("password");
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    globalSetState = setState;
    return () => { globalSetState = null; };
  }, []);

  useEffect(() => {
    if (state.open) {
      setPassword("");
      setCode("");
      setTab("password");
      setTimeout(() => passwordRef.current?.focus(), 80);
    }
  }, [state.open]);

  function cancel() {
    globalResolve?.(null);
    setState({ open: false, options: null, resolve: null });
  }

  function submit() {
    if (tab === "password" && !password) return;
    if (tab === "code" && !code) return;
    const payload: ReAuthPayload = tab === "password"
      ? { confirm_password: password }
      : { confirm_code: code };
    globalResolve?.(payload);
    setState({ open: false, options: null, resolve: null });
  }

  if (!state.open || !state.options) return null;

  const { title, description, dangerLabel = "Potvrdiť" } = state.options;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={cancel}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 400,
          background: "#fff", borderRadius: 16,
          padding: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>{title}</h2>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px", lineHeight: 1.5 }}>{description}</p>

        <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "#F3F4F6", padding: 4, borderRadius: 10 }}>
          <button
            type="button"
            onClick={() => setTab("password")}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8, border: 0, cursor: "pointer",
              fontWeight: 600, fontSize: 12,
              background: tab === "password" ? "#fff" : "transparent",
              color: tab === "password" ? "#0F172A" : "#6B7280",
              boxShadow: tab === "password" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            Heslo
          </button>
          <button
            type="button"
            onClick={() => setTab("code")}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8, border: 0, cursor: "pointer",
              fontWeight: 600, fontSize: 12,
              background: tab === "code" ? "#fff" : "transparent",
              color: tab === "code" ? "#0F172A" : "#6B7280",
              boxShadow: tab === "code" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            2FA kód
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {tab === "password" ? (
            <input
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              placeholder="Tvoje heslo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: "12px 14px", fontSize: 14,
                borderRadius: 10, border: "1px solid #E5E7EB",
                outline: "none",
              }}
            />
          ) : (
            <input
              type="text"
              autoComplete="one-time-code"
              inputMode="text"
              placeholder="6-cifrový kód alebo backup XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, 16))}
              autoFocus
              style={{
                padding: "12px 14px", fontSize: 16,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.15em",
                textAlign: "center",
                borderRadius: 10, border: "1px solid #E5E7EB",
                outline: "none",
              }}
            />
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={cancel}
              style={{
                flex: 1, padding: "10px 16px", border: "1px solid #E5E7EB",
                borderRadius: 10, background: "#fff", color: "#374151",
                cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}
            >
              Zrušiť
            </button>
            <button
              type="submit"
              disabled={tab === "password" ? !password : !code}
              style={{
                flex: 1, padding: "10px 16px", border: 0,
                borderRadius: 10,
                background: (tab === "password" ? !password : !code) ? "#E5E7EB" : "#0F172A",
                color: (tab === "password" ? !password : !code) ? "#9CA3AF" : "#fff",
                cursor: (tab === "password" ? !password : !code) ? "not-allowed" : "pointer",
                fontWeight: 600, fontSize: 13,
              }}
            >
              {dangerLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
