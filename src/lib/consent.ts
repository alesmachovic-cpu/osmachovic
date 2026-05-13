export type ConsentPrefs = {
  analytics: boolean;
  marketing: boolean;
};

const STORAGE_KEY = "cookie_consent_v1";

export function getConsent(): ConsentPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setConsent(prefs: ConsentPrefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  // Nastaviť aj cookie pre server-side čítanie (1 rok)
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(JSON.stringify(prefs))}; expires=${expires}; path=/; SameSite=Lax`;
}

export function hasConsent(category: keyof ConsentPrefs): boolean {
  const prefs = getConsent();
  if (!prefs) return false;
  return prefs[category] === true;
}
