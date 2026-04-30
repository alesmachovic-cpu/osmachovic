/**
 * Vytvorí 2-písmenové iniciálky z mena, s odstránením akademických titulov
 * (Mgr., Ing., Bc., MBA, PhD, Doc., Prof., JUD, MUDr., …).
 *
 * Príklad: "Mgr. Slavomír Kollár" → "SK"
 */
export function makeInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const titles = /\b(mgr|ing|bc|mba|phd|ph\.d|doc|prof|jud|mudr|mvdr|rndr|paeddr|judr|mgr\.art)\.?\s*/gi;
  const cleaned = name.replace(titles, "").replace(/[,.]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
}
