export type NavItem = { label: string; href: string; icon: string; badge?: number; matchPrefix?: string; minRole?: "manazer" | "majitel" | "super_admin" };

export const mainNavBase: NavItem[] = [
  { label: "Prehľad",           href: "/",                         icon: "📊" },
  { label: "Portfólio",         href: "/portfolio",                icon: "🏠" },
  { label: "Klienti",           href: "/klienti?tab=predavajuci",  icon: "👥", matchPrefix: "/klienti" },
  { label: "Náberový list",     href: "/naber",                    icon: "📝" },
  { label: "Monitor & Analýza", href: "/monitor?tab=scraping",     icon: "📡", matchPrefix: "/monitor" },
  { label: "Štatistiky",        href: "/statistiky",               icon: "📉" },
  { label: "Náklady",           href: "/operativa?tab=naklady",    icon: "💰", matchPrefix: "/operativa" },
];

export const operativaNav: NavItem[] = [
  { label: "Provízie",           href: "/potvrdenie-provizii", icon: "✅" },
  { label: "Odberatelia",        href: "/odberatelia",         icon: "🏷️" },
  { label: "Faktúry",            href: "/faktury",             icon: "🧾" },
  { label: "Prehľad financií",  href: "/prehlad-financii",    icon: "💶" },
  { label: "Účtovný prehľad",   href: "/uctovny-prehlad",     icon: "📊" },
  { label: "Pravidelné náklady", href: "/pravidelne-naklady",  icon: "🔁" },
];

export const systemNav: NavItem[] = [
  { label: "Gmail",         href: "/gmail",         icon: "✉️" },
  { label: "Kalendár",      href: "/kalendar",      icon: "📅" },
  { label: "Google Disk",   href: "/disk",          icon: "💾" },
  { label: "Upozornenia",   href: "/upozornenia",   icon: "🔔" },
  { label: "Tím",           href: "/tim",           icon: "👥", minRole: "manazer" },
  { label: "Manažér",       href: "/manazer",       icon: "📊" },
  { label: "Klientská zóna", href: "/klientska-zona", icon: "🌐" },
  { label: "Plán systému",  href: "/plan",          icon: "🗺️" },
  { label: "Nastavenia",    href: "/nastavenia",    icon: "⚙️" },
  { label: "Notifikácie",   href: "/notifikacie",   icon: "🔕", badge: 2 },
  { label: "System Log",    href: "/log",           icon: "📋" },
];

export const devNav: NavItem[] = [
  { label: "Kalkulátor", href: "/nastroje?tab=kalkulator", icon: "🧮", matchPrefix: "/nastroje" },
  { label: "Matching",   href: "/matching",                icon: "🔍" },
];
