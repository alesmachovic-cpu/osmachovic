"use client";

import { useState, useRef, useEffect } from "react";

const COUNTRIES = [
  { code: "SK", dial: "+421", flag: "\u{1F1F8}\u{1F1F0}", name: "Slovensko", length: 9 },
  { code: "CZ", dial: "+420", flag: "\u{1F1E8}\u{1F1FF}", name: "Česko", length: 9 },
  { code: "HU", dial: "+36", flag: "\u{1F1ED}\u{1F1FA}", name: "Maďarsko", length: 9 },
  { code: "AT", dial: "+43", flag: "\u{1F1E6}\u{1F1F9}", name: "Rakúsko", length: 10 },
  { code: "PL", dial: "+48", flag: "\u{1F1F5}\u{1F1F1}", name: "Poľsko", length: 9 },
  { code: "DE", dial: "+49", flag: "\u{1F1E9}\u{1F1EA}", name: "Nemecko", length: 11 },
  { code: "UA", dial: "+380", flag: "\u{1F1FA}\u{1F1E6}", name: "Ukrajina", length: 9 },
  { code: "GB", dial: "+44", flag: "\u{1F1EC}\u{1F1E7}", name: "Veľká Británia", length: 10 },
  { code: "US", dial: "+1", flag: "\u{1F1FA}\u{1F1F8}", name: "USA", length: 10 },
];

function detectCountry(phone: string) {
  const clean = phone.replace(/[\s\-\(\)]/g, "");
  for (const c of COUNTRIES) {
    if (clean.startsWith(c.dial)) return c;
  }
  return null;
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  borderOverride?: string;
  autoFocus?: boolean;
  placeholder?: string;
}

export default function PhoneInput({ value, onChange, style, borderOverride, autoFocus, placeholder }: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(COUNTRIES[0]); // Default SK
  const dropRef = useRef<HTMLDivElement>(null);

  // Detect country from value on mount
  useEffect(() => {
    const det = detectCountry(value);
    if (det) setSelected(det);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleCountrySelect(c: typeof COUNTRIES[number]) {
    setSelected(c);
    setOpen(false);
    // Replace prefix in value
    const clean = value.replace(/[\s\-\(\)]/g, "");
    const currentCountry = detectCountry(clean);
    if (currentCountry) {
      const rest = clean.slice(currentCountry.dial.length);
      onChange(c.dial + " " + rest);
    } else {
      const digits = clean.replace(/\D/g, "");
      onChange(c.dial + " " + digits);
    }
  }

  function handleChange(raw: string) {
    onChange(raw);
    const det = detectCountry(raw);
    if (det) setSelected(det);
  }

  // Validation: only after enough digits
  const digits = value.replace(/\D/g, "");
  const dialDigits = selected.dial.replace(/\D/g, "");
  const numberDigits = digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits;
  const isComplete = numberDigits.length >= selected.length;
  const isValid = isComplete && numberDigits.length <= selected.length + 2;
  const showValidation = numberDigits.length >= selected.length - 1;

  return (
    <div style={{ position: "relative" }} ref={dropRef}>
      <div style={{
        display: "flex", alignItems: "center",
        border: borderOverride || (showValidation ? (isValid ? "2px solid #10B981" : "2px solid #EF4444") : "1px solid var(--border)"),
        borderRadius: "10px", overflow: "hidden",
        background: "var(--bg-elevated)",
        transition: "border-color 0.2s",
        ...style,
      }}>
        {/* Country selector */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            padding: "10px 8px 10px 12px",
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: "18px", flexShrink: 0,
            borderRight: "1px solid var(--border)",
          }}
        >
          <span>{selected.flag}</span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "2px" }}>▼</span>
        </button>

        {/* Phone input */}
        <input
          type="tel"
          value={value}
          onChange={e => handleChange(e.target.value)}
          autoFocus={autoFocus}
          placeholder={placeholder || `${selected.dial} ...`}
          style={{
            flex: 1, padding: "10px 12px", border: "none", outline: "none",
            background: "transparent", fontSize: "14px", color: "var(--text-primary)",
            width: "100%",
          }}
        />

        {/* Validation indicator */}
        {showValidation && (
          <span style={{ paddingRight: "12px", fontSize: "14px", flexShrink: 0 }}>
            {isValid ? "✅" : "❌"}
          </span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          marginTop: "4px", borderRadius: "12px",
          background: "var(--bg-surface, #fff)",
          border: "1px solid var(--border, #e5e7eb)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          maxHeight: "240px", overflowY: "auto",
        }}>
          {COUNTRIES.map(c => (
            <button
              key={c.code}
              onClick={() => handleCountrySelect(c)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                width: "100%", padding: "10px 14px", border: "none",
                background: c.code === selected.code ? "var(--bg-elevated, #f3f4f6)" : "transparent",
                cursor: "pointer", fontSize: "13px", color: "var(--text-primary, #1f2937)",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: "18px" }}>{c.flag}</span>
              <span style={{ flex: 1, fontWeight: c.code === selected.code ? "600" : "400" }}>{c.name}</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted, #9ca3af)" }}>{c.dial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { COUNTRIES, detectCountry };
