import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export const runtime = "nodejs";

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

const WMO_ICON: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "❄️", 73: "❄️", 75: "❄️",
  80: "🌦️", 81: "🌧️", 82: "🌧️",
  85: "❄️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

function iconFromCode(code: number): string {
  return WMO_ICON[code] ?? "🌡️";
}

function suitability(precipProb: number, windMax: number): "EXCELLENT" | "GOOD" | "POOR" {
  if (precipProb < 20 && windMax < 6) return "EXCELLENT";
  if (precipProb < 50 && windMax < 10) return "GOOD";
  return "POOR";
}

function formatTime(iso: string): string {
  return iso.slice(11, 16); // "05:32"
}

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&countrycodes=sk&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "VIANEMA-CRM/1.0" } });
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

async function fetchWeather(city: string): Promise<WeatherDay[]> {
  const coords = await geocodeCity(city);
  if (!coords) return [];

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coords.lat));
  url.searchParams.set("longitude", String(coords.lng));
  url.searchParams.set("daily", [
    "weathercode", "temperature_2m_max", "temperature_2m_min",
    "precipitation_probability_max", "windspeed_10m_max",
    "sunrise", "sunset",
  ].join(","));
  url.searchParams.set("timezone", "Europe/Bratislava");
  url.searchParams.set("forecast_days", "14");

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const json = await res.json() as {
    daily: {
      time: string[];
      weathercode: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
      windspeed_10m_max: number[];
      sunrise: string[];
      sunset: string[];
    };
  };

  const d = json.daily;
  return d.time.map((date, i) => {
    const precipProb = d.precipitation_probability_max[i] ?? 0;
    const windMax = d.windspeed_10m_max[i] ?? 0;
    return {
      date,
      icon: iconFromCode(d.weathercode[i] ?? 0),
      tempMax: Math.round(d.temperature_2m_max[i] ?? 0),
      tempMin: Math.round(d.temperature_2m_min[i] ?? 0),
      precipProb,
      windMax: Math.round(windMax),
      sunrise: formatTime(d.sunrise[i] ?? ""),
      sunset: formatTime(d.sunset[i] ?? ""),
      suitability: suitability(precipProb, windMax),
      droneSuitable: windMax < 8 && precipProb < 30,
    };
  });
}

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });

  const getCached = unstable_cache(
    () => fetchWeather(city),
    [`weather:${city.toLowerCase()}`],
    { revalidate: 21600 },
  );

  const days = await getCached();
  return NextResponse.json({ days });
}
