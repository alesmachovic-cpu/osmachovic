const ALL_FEATURES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "klienti", label: "Klienti (predávajúci)" },
  { id: "kupujuci", label: "Kupujúci" },
  { id: "portfolio", label: "Portfolio / Inzeráty" },
  { id: "nabery", label: "Náberové listy" },
  { id: "ai_writer", label: "AI Writer" },
  { id: "kalendar", label: "Kalendár" },
  { id: "vyhladavanie", label: "Vyhľadávanie" },
  { id: "nastavenia", label: "Nastavenia" },
] as const;

type FeatureId = typeof ALL_FEATURES[number]["id"];
type FeatureToggles = Record<string, Record<FeatureId, boolean>>;

function loadFeatureToggles(): FeatureToggles {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("feature_toggles");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveFeatureToggles(toggles: FeatureToggles) {
  localStorage.setItem("feature_toggles", JSON.stringify(toggles));
}

function isFeatureEnabled(userId: string, featureId: string): boolean {
  if (userId === "ales") return true; // admin always has all features
  const toggles = loadFeatureToggles();
  const userToggles = toggles[userId];
  if (!userToggles) return true; // default: all enabled
  return userToggles[featureId as FeatureId] !== false;
}

export { ALL_FEATURES, loadFeatureToggles, saveFeatureToggles, isFeatureEnabled };
export type { FeatureId, FeatureToggles };
