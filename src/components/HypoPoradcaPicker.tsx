"use client";

type HypoTyp = "nas_poradca" | "externy" | "klient_sam";

type Value = {
  hypo_typ: HypoTyp | null;
  hypo_meno: string | null;
  hypo_firma: string | null;
  hypo_poradca_id: string | null;
};

type Props = {
  value: Value;
  onChange: (v: Value) => void;
  disabled?: boolean;
};

const OPTIONS: { value: HypoTyp; label: string; disabled?: boolean }[] = [
  { value: "nas_poradca", label: "Náš poradca", disabled: true },
  { value: "externy",     label: "Externý poradca" },
  { value: "klient_sam",  label: "Klient si rieši sám" },
];

const inputSt: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  color: "var(--text-primary)", fontSize: 13, outline: "none",
};

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4,
};

export default function HypoPoradcaPicker({ value, onChange, disabled }: Props) {
  function setTyp(typ: HypoTyp) {
    // Pri zmene typu vyčisti polia ktoré sa už nehodia, aby v DB nezostal stale data
    if (typ === "nas_poradca") {
      onChange({ hypo_typ: typ, hypo_meno: null, hypo_firma: null, hypo_poradca_id: value.hypo_poradca_id });
    } else if (typ === "externy") {
      onChange({ hypo_typ: typ, hypo_meno: value.hypo_meno, hypo_firma: value.hypo_firma, hypo_poradca_id: null });
    } else {
      onChange({ hypo_typ: typ, hypo_meno: null, hypo_firma: value.hypo_firma, hypo_poradca_id: null });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {OPTIONS.map(opt => {
          const active = value.hypo_typ === opt.value;
          const isDisabled = !!disabled || opt.disabled;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && setTyp(opt.value)}
              title={opt.disabled ? "Zatiaľ nedostupné — entita poradcov sa pridá neskôr" : undefined}
              style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: active ? "var(--text-primary)" : "var(--bg-elevated)",
                color: active ? "var(--bg-surface)" : "var(--text-secondary)",
                border: "1px solid var(--border)",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled && !active ? 0.5 : 1,
              }}
            >
              {opt.label}{opt.disabled ? " (čoskoro)" : ""}
            </button>
          );
        })}
      </div>

      {value.hypo_typ === "nas_poradca" && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: 8 }}>
          Zoznam našich hypo poradcov sa pridá v ďalšej iterácii. Zatiaľ použi „Externý poradca" alebo „Klient si rieši sám".
        </div>
      )}

      {value.hypo_typ === "externy" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={labelSt}>Meno poradcu</div>
            <input
              type="text"
              value={value.hypo_meno || ""}
              disabled={disabled}
              onChange={e => onChange({ ...value, hypo_meno: e.target.value || null })}
              placeholder="napr. Ján Mrkvička"
              style={inputSt}
            />
          </div>
          <div>
            <div style={labelSt}>Firma</div>
            <input
              type="text"
              value={value.hypo_firma || ""}
              disabled={disabled}
              onChange={e => onChange({ ...value, hypo_firma: e.target.value || null })}
              placeholder="napr. Hypocentrum, FinComfort…"
              style={inputSt}
            />
          </div>
        </div>
      )}

      {value.hypo_typ === "klient_sam" && (
        <div>
          <div style={labelSt}>V ktorej banke</div>
          <input
            type="text"
            value={value.hypo_firma || ""}
            disabled={disabled}
            onChange={e => onChange({ ...value, hypo_firma: e.target.value || null })}
            placeholder="napr. Slovenská sporiteľňa, VÚB, Tatra banka…"
            style={inputSt}
          />
        </div>
      )}
    </div>
  );
}
