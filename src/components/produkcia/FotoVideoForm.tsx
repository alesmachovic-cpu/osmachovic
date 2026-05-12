"use client";

import { useState, lazy, Suspense } from "react";
import {
  PROPERTY_TYPE_OPTIONS, REGION_OPTIONS, SERVICES_OPTIONS,
  PREFERRED_DAYS_OPTIONS, LAND_SIZE_OPTIONS,
  mapPropertyType, regionFromCity, needsLandSize,
  type PropertyTypeMapped,
} from "@/lib/produkcia/mapping";

const WeatherCalendar = lazy(() => import("./WeatherCalendar"));

interface KlientData {
  meno: string;
  telefon?: string | null;
  lokalita?: string | null;
  typ_nehnutelnosti?: string | null;
}

interface MaklerData {
  name: string;
}

interface Props {
  klient: KlientData;
  makler: MaklerData;
  onSave: (details: Record<string, unknown>, submit: boolean) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export default function FotoVideoForm({ klient, makler, onSave, onCancel, saving }: Props) {
  const [propertyType, setPropertyType] = useState<PropertyTypeMapped>(
    mapPropertyType(klient.typ_nehnutelnosti),
  );
  const [region, setRegion] = useState<"Z" | "S" | "V">(
    regionFromCity(klient.lokalita ?? ""),
  );
  const [landSize, setLandSize] = useState("NEAPLIKUJE");
  const [highlights, setHighlights] = useState("");
  const [onSitePerson, setOnSitePerson] = useState<"SELF" | "OWNER" | "OTHER_AGENT">("SELF");
  const [otherAgentName, setOtherAgentName] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [selectedWeatherDays, setSelectedWeatherDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState("");
  const [services, setServices] = useState<string[]>(["FOTO"]);
  const [aiVoiceConsent, setAiVoiceConsent] = useState(false);
  const [notes, setNotes] = useState("");

  const requireDrone = services.includes("DRON");

  function toggleService(val: string) {
    setServices(prev =>
      prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val],
    );
  }

  function buildDetails() {
    const d: Record<string, unknown> = {
      region,
      property_type_mapped: propertyType,
      on_site_person: onSitePerson,
      preferred_days: selectedWeatherDays,
      services,
      ai_voice_consent: aiVoiceConsent,
    };
    if (needsLandSize(propertyType)) d.land_size = landSize;
    if (highlights.trim()) d.highlights = highlights.trim();
    if (onSitePerson === "OTHER_AGENT" && otherAgentName.trim()) d.other_agent_name = otherAgentName.trim();
    if (onSitePerson === "OWNER" && ownerContact.trim()) d.owner_contact = ownerContact.trim();
    if (preferredTime.trim()) d.preferred_time = preferredTime.trim();
    if (notes.trim()) d.notes = notes.trim();
    return d;
  }

  const canSubmit = services.length > 0;

  const labelSt: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px", display: "block",
  };
  const inputSt: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "8px", fontSize: "14px",
    border: "1px solid var(--border)", background: "var(--bg-surface)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
  };
  const sectionSt: React.CSSProperties = { marginBottom: "20px" };
  const readonlyRowSt: React.CSSProperties = {
    display: "flex", gap: "8px", alignItems: "center",
    padding: "9px 12px", borderRadius: "8px",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    fontSize: "14px", color: "var(--text-primary)",
  };

  return (
    <div style={{ padding: "0 0 8px" }}>

      {/* Auto-vyplnené — read-only */}
      <div style={sectionSt}>
        <div style={{ ...labelSt, marginBottom: "8px" }}>Predvyplnené údaje</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={readonlyRowSt}>
            <span style={{ color: "var(--text-muted)", fontSize: "13px", minWidth: "80px" }}>Maklér</span>
            <span style={{ fontWeight: 600 }}>{makler.name}</span>
          </div>
          <div style={readonlyRowSt}>
            <span style={{ color: "var(--text-muted)", fontSize: "13px", minWidth: "80px" }}>Klient</span>
            <span style={{ fontWeight: 600 }}>{klient.meno}</span>
            {klient.telefon && <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>{klient.telefon}</span>}
          </div>
          {klient.lokalita && (
            <div style={readonlyRowSt}>
              <span style={{ color: "var(--text-muted)", fontSize: "13px", minWidth: "80px" }}>Lokalita</span>
              <span>{klient.lokalita}</span>
            </div>
          )}
        </div>
      </div>

      {/* Región */}
      <div style={sectionSt}>
        <label style={labelSt}>Región</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {REGION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRegion(opt.value)}
              style={{
                padding: "7px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: 500,
                border: `1.5px solid ${region === opt.value ? "#2563eb" : "var(--border)"}`,
                background: region === opt.value ? "#dbeafe" : "var(--bg-surface)",
                color: region === opt.value ? "#1d4ed8" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Typ nehnuteľnosti */}
      <div style={sectionSt}>
        <label style={labelSt}>Typ nehnuteľnosti</label>
        <select
          value={propertyType}
          onChange={e => setPropertyType(e.target.value as PropertyTypeMapped)}
          style={inputSt}
        >
          {PROPERTY_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Veľkosť pozemku — podmienené */}
      {needsLandSize(propertyType) && (
        <div style={sectionSt}>
          <label style={labelSt}>Veľkosť pozemku</label>
          <select value={landSize} onChange={e => setLandSize(e.target.value)} style={inputSt}>
            {LAND_SIZE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Špecifiká */}
      <div style={sectionSt}>
        <label style={labelSt}>Špecifiká nehnuteľnosti <span style={{ fontWeight: 400, textTransform: "none" }}>(voliteľné)</span></label>
        <textarea
          value={highlights}
          onChange={e => setHighlights(e.target.value)}
          placeholder="Napr. strešná terasa, neopravená pivnica, špeciálny vstup…"
          maxLength={500}
          rows={2}
          style={{ ...inputSt, resize: "vertical" }}
        />
      </div>

      {/* Kto bude na mieste */}
      <div style={sectionSt}>
        <label style={labelSt}>Kto bude na nehnuteľnosti</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {[
            { value: "SELF",        label: "Ja (maklér)" },
            { value: "OWNER",       label: "Vlastník" },
            { value: "OTHER_AGENT", label: "Iný maklér" },
          ].map(opt => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="radio"
                name="onSitePerson"
                value={opt.value}
                checked={onSitePerson === opt.value}
                onChange={() => setOnSitePerson(opt.value as "SELF" | "OWNER" | "OTHER_AGENT")}
                style={{ accentColor: "#2563eb" }}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {onSitePerson === "OTHER_AGENT" && (
          <input
            value={otherAgentName}
            onChange={e => setOtherAgentName(e.target.value)}
            placeholder="Meno makléra"
            style={{ ...inputSt, marginTop: "8px" }}
          />
        )}
        {onSitePerson === "OWNER" && (
          <input
            value={ownerContact}
            onChange={e => setOwnerContact(e.target.value)}
            placeholder="Telefón alebo email vlastníka"
            style={{ ...inputSt, marginTop: "8px" }}
          />
        )}
      </div>

      {/* Výber služieb */}
      <div style={sectionSt}>
        <label style={labelSt}>Služby <span style={{ color: "#dc2626" }}>*</span></label>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {SERVICES_OPTIONS.map(opt => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={services.includes(opt.value)}
                onChange={() => toggleService(opt.value)}
                style={{ accentColor: "#2563eb", width: "16px", height: "16px" }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Weather kalendár */}
      <div style={sectionSt}>
        <label style={labelSt}>
          Preferované dni natáčania
          {requireDrone && <span style={{ color: "#7c3aed", marginLeft: "6px", textTransform: "none", fontWeight: 400 }}>— dni nevhodné pre dron sú sivé</span>}
        </label>
        {klient.lokalita ? (
          <Suspense fallback={
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px" }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} style={{ height: "88px", borderRadius: "10px", background: "var(--bg-elevated)" }} />
              ))}
            </div>
          }>
            <WeatherCalendar
              city={klient.lokalita}
              selectedDays={selectedWeatherDays}
              onSelect={setSelectedWeatherDays}
              requireDrone={requireDrone}
            />
          </Suspense>
        ) : (
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
              Klient nemá lokalitu — vyber dni manuálne:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {PREFERRED_DAYS_OPTIONS.map(opt => {
                const sel = selectedWeatherDays.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedWeatherDays(prev =>
                      prev.includes(opt.value)
                        ? prev.filter(d => d !== opt.value)
                        : [...prev, opt.value],
                    )}
                    style={{
                      padding: "7px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: 500,
                      border: `1.5px solid ${sel ? "#2563eb" : "var(--border)"}`,
                      background: sel ? "#dbeafe" : "var(--bg-surface)",
                      color: sel ? "#1d4ed8" : "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Preferovaný čas */}
      <div style={sectionSt}>
        <label style={labelSt}>Preferovaný čas <span style={{ fontWeight: 400, textTransform: "none" }}>(voliteľné)</span></label>
        <input
          value={preferredTime}
          onChange={e => setPreferredTime(e.target.value)}
          placeholder="napr. 9:00–12:00"
          style={inputSt}
        />
      </div>

      {/* AI hlas */}
      <div style={{ ...sectionSt, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Súhlas s AI hlasom</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Klient súhlasí s použitím AI hlasu vo videu</div>
        </div>
        <button
          type="button"
          onClick={() => setAiVoiceConsent(v => !v)}
          style={{
            width: "44px", height: "26px", borderRadius: "13px", border: "none",
            background: aiVoiceConsent ? "#2563eb" : "#d1d5db",
            cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute", top: "3px",
            left: aiVoiceConsent ? "21px" : "3px",
            width: "20px", height: "20px", borderRadius: "50%",
            background: "#fff", transition: "left 0.2s",
          }} />
        </button>
      </div>

      {/* Poznámka */}
      <div style={sectionSt}>
        <label style={labelSt}>Poznámka <span style={{ fontWeight: 400, textTransform: "none" }}>(voliteľné)</span></label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ďalšie informácie pre produkčný tím…"
          rows={2}
          style={{ ...inputSt, resize: "vertical" }}
        />
      </div>

      {/* Tlačidlá */}
      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1, padding: "11px", borderRadius: "10px", fontSize: "14px",
            border: "1px solid var(--border)", background: "var(--bg-surface)",
            color: "var(--text-primary)", cursor: "pointer", fontWeight: 500,
          }}
        >
          Zrušiť
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(buildDetails(), false)}
          style={{
            flex: 1, padding: "11px", borderRadius: "10px", fontSize: "14px",
            border: "1px solid var(--border)", background: "var(--bg-elevated)",
            color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 500, opacity: saving ? 0.5 : 1,
          }}
        >
          Uložiť koncept
        </button>
        <button
          type="button"
          disabled={saving || !canSubmit}
          onClick={() => onSave(buildDetails(), true)}
          style={{
            flex: 2, padding: "11px", borderRadius: "10px", fontSize: "14px",
            border: "none", background: canSubmit && !saving ? "#2563eb" : "#93c5fd",
            color: "#fff", cursor: saving || !canSubmit ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {saving ? "Odosielam…" : "📸 Odoslať tímu"}
        </button>
      </div>
    </div>
  );
}
