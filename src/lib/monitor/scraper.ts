/* ── Scraping vrstva s anti-bot ochranou ── */

/**
 * Stratégia: ScrapingBee → priamy fetch (fallback)
 *
 * ScrapingBee rieši:
 * - JavaScript rendering (SPA portály)
 * - Rotácia IP + proxy
 * - CAPTCHA riešenie
 * - Cloudflare bypass
 *
 * Vercel limity:
 * - maxDuration: 30s (hobby) / 60s (pro)
 * - Pamäť: 1024 MB
 * - Riešenie: Scraping po jednom filtri za request, nie všetky naraz
 */

const SCRAPINGBEE_API = "https://app.scrapingbee.com/api/v1";

interface FetchPageOptions {
  url: string;
  renderJs?: boolean;
  premium?: boolean;    // premium proxy pre ťažké anti-bot stránky
  waitMs?: number;      // počkaj na JS renderovanie
  cssSelector?: string; // extrahuj len konkrétny element
}

interface FetchPageResult {
  html: string;
  status: number;
  cost: number; // koľko kreditov to stálo
}

/**
 * Stiahne HTML stránku cez ScrapingBee API.
 * Fallback na priamy fetch ak nemáme API kľúč.
 */
export async function fetchPage(options: FetchPageOptions): Promise<FetchPageResult> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;

  // Ak nemáme ScrapingBee, skúsime priamy fetch
  if (!apiKey) {
    return fetchDirect(options.url);
  }

  return fetchViaScrapingBee(apiKey, options);
}

async function fetchViaScrapingBee(
  apiKey: string,
  options: FetchPageOptions
): Promise<FetchPageResult> {
  const params = new URLSearchParams({
    api_key: apiKey,
    url: options.url,
    render_js: String(options.renderJs ?? true),
    // Slovenský content — nastavíme SK lokalizáciu
    country_code: "sk",
  });

  if (options.premium) {
    params.set("premium_proxy", "true");
  }
  if (options.waitMs) {
    params.set("wait", String(options.waitMs));
  }
  if (options.cssSelector) {
    params.set("extract_rules", JSON.stringify({
      listings: { selector: options.cssSelector, type: "list", output: "html" },
    }));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout (Vercel = 30s)

  try {
    const res = await fetch(`${SCRAPINGBEE_API}?${params.toString()}`, {
      signal: controller.signal,
    });

    const html = await res.text();
    const cost = parseInt(res.headers.get("Spb-Cost") || "1");

    if (!res.ok) {
      throw new Error(`ScrapingBee ${res.status}: ${html.substring(0, 200)}`);
    }

    return { html, status: res.status, cost };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDirect(url: string): Promise<FetchPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "sk-SK,sk;q=0.9,cs;q=0.8",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const html = await res.text();
    return { html, status: res.status, cost: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Kontrola zostatku kreditov ScrapingBee.
 */
export async function getScrapingBeeCredits(): Promise<number | null> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://app.scrapingbee.com/api/v1/usage?api_key=${apiKey}`
    );
    const data = await res.json();
    return data.max_api_credit - data.used_api_credit;
  } catch {
    return null;
  }
}
