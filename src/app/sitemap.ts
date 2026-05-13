import type { MetadataRoute } from "next";

const BASE = "https://vianema.sk";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastMod = new Date("2026-05-13");

  const publicPages = [
    "/",
    "/o-nas",
    "/kontakt",
    "/bezpecnost",
    "/pristupnost",
    "/gdpr",
    "/cookies",
    "/podmienky-pouzitia",
    "/obchodne-podmienky",
    "/reklamacny-poriadok",
    "/aml-poucenie",
    "/eticky-kodex",
    "/transparency",
  ];

  return publicPages.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: lastMod,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/kontakt" ? 0.9 : 0.7,
  }));
}
