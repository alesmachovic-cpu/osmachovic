"use client";

import { useEffect, useState } from "react";

type WeatherDay = {
  date: string;
  icon: string;
  tempMax: number;
  tempMin: number;
  precipProb: number;
  windMax: number;
  sunrise: string;
  sunset: string;
  suitability: "EXCELLENT" | "GOOD" | "POOR";
  droneSuitable: boolean;
};

const DAY_SK = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
const MONTH_SK = ["jan","feb","mar","apr","máj","jún","júl","aug","sep","okt","nov","dec"];

const SUIT_BG: Record<string, string> = {
  EXCELLENT: "#dcfce7",
  GOOD:      "#fef9c3",
  POOR:      "#fee2e2",
};
const SUIT_BORDER: Record<string, string> = {
  EXCELLENT: "#16a34a",
  GOOD:      "#ca8a04",
  POOR:      "#dc2626",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${DAY_SK[d.getDay()]} ${d.getDate()}. ${MONTH_SK[d.getMonth()]}`;
}

function bestDay(days: WeatherDay[]): WeatherDay | null {
  const excellent = days.filter(d => d.suitability === "EXCELLENT");
  if (excellent.length) return excellent[0];
  const good = days.filter(d => d.suitability === "GOOD");
  return good[0] ?? null;
}

interface Props {
  city: string;
  selectedDays: string[];
  onSelect: (days: string[]) => void;
  requireDrone?: boolean;
}

export default function WeatherCalendar({ city, selectedDays, onSelect, requireDrone = false }: Props) {
  const [days, setDays] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    setError("");
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then(r => r.json())
      .then(d => {
        setDays(d.days ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Počasie sa nepodarilo načítať");
        setLoading(false);
      });
  }, [city]);

  function toggle(date: string, disabled: boolean) {
    if (disabled) return;
    onSelect(
      selectedDays.includes(date)
        ? selectedDays.filter(d => d !== date)
        : [...selectedDays, date],
    );
  }

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{
            height: "88px", borderRadius: "10px",
            background: "var(--bg-elevated)", animation: "pulse 1.5s infinite",
          }} />
        ))}
      </div>
    );
  }

  if (error || !days.length) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        {error || "Počasie nie je dostupné pre túto lokalitu"}
      </div>
    );
  }

  const best = bestDay(days.filter(d => !requireDrone || d.droneSuitable));

  return (
    <div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "5px",
        marginBottom: "10px",
      }}>
        {days.map(day => {
          const disabled = requireDrone && !day.droneSuitable;
          const selected = selectedDays.includes(day.date);
          const bg = disabled ? "#f3f4f6" : SUIT_BG[day.suitability];
          const borderColor = selected
            ? "#2563eb"
            : disabled ? "#d1d5db" : SUIT_BORDER[day.suitability];

          const d = new Date(day.date);
          const dayLabel = DAY_SK[d.getDay()];
          const dateLabel = `${d.getDate()}.${d.getMonth() + 1}`;

          return (
            <div
              key={day.date}
              onClick={() => toggle(day.date, disabled)}
              style={{
                background: selected ? "#dbeafe" : bg,
                border: `2px solid ${borderColor}`,
                borderRadius: "10px",
                padding: "6px 4px",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.45 : 1,
                textAlign: "center",
                userSelect: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 600, color: "#374151" }}>{dayLabel}</div>
              <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>{dateLabel}</div>
              <div style={{ fontSize: "18px", lineHeight: 1 }}>{day.icon}</div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#111827", marginTop: "2px" }}>
                {day.tempMax}°
              </div>
              <div style={{ fontSize: "10px", color: "#6b7280" }}>{day.tempMin}°</div>
              <div style={{ fontSize: "10px", color: "#3b82f6" }}>💧{day.precipProb}%</div>
              <div style={{ fontSize: "10px", color: "#6b7280" }}>💨{day.windMax}</div>
            </div>
          );
        })}
      </div>

      {best && (
        <div style={{
          padding: "10px 14px", borderRadius: "10px",
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          fontSize: "13px", color: "#15803d",
        }}>
          🎯 Najlepší deň: <strong>{formatDate(best.date)}</strong> — {best.icon} {best.tempMax}°C, zrážky {best.precipProb}%, vietor {best.windMax} m/s
        </div>
      )}

      {selectedDays.length > 0 && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#2563eb" }}>
          Vybrané: {selectedDays.map(d => {
            const dt = new Date(d);
            return `${DAY_SK[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}`;
          }).join(", ")}
        </div>
      )}
    </div>
  );
}
