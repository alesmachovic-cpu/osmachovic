"use client";

import { useState } from "react";

/**
 * Password input s reveal-toggle eye iconou. Použiť všade kde je `<input type="password">`
 * v formulároch (login, reset, change password). Prijíma rovnaké props ako input.
 *
 * Eye icon je absolútne pozicionovaná vnútri obalu, takže input má vyplnený
 * pravý padding aby sa text nestretával s ikonou.
 */
export default function PasswordInput({
  value,
  onChange,
  onInput,
  placeholder = "••••••••",
  disabled = false,
  autoComplete = "current-password",
  style = {},
  inverse = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInput?: (e: React.FormEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  /** Doplňujúce CSS — prepíše defaulty (napr. background pre tmavý glass design). */
  style?: React.CSSProperties;
  /** True pre tmavé pozadie (login obrazovka) — eye icon zmení farbu. */
  inverse?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        type={revealed ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        onInput={onInput}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "13px 44px 13px 16px",
          borderRadius: "12px",
          fontSize: "14px",
          outline: "none",
          ...style,
        }}
      />
      <button
        type="button"
        onClick={() => setRevealed(r => !r)}
        disabled={disabled}
        aria-label={revealed ? "Skryť heslo" : "Zobraziť heslo"}
        title={revealed ? "Skryť heslo" : "Zobraziť heslo"}
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "28px",
          height: "28px",
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: inverse ? "rgba(255,255,255,0.55)" : "#6B7280",
          opacity: disabled ? 0.4 : 1,
          fontSize: "16px",
        }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = inverse ? "#fff" : "#111827"; }}
        onMouseLeave={e => { e.currentTarget.style.color = inverse ? "rgba(255,255,255,0.55)" : "#6B7280"; }}
      >
        {revealed ? (
          // eye-off (zatvorené oko)
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // eye (otvorené oko)
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
