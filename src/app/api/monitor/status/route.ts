import { NextResponse } from "next/server";
import { getScrapingBeeCredits } from "@/lib/monitor";

export const runtime = "nodejs";

/**
 * GET /api/monitor/status
 * Vracia info o ScrapingBee (credits left) + ktoré portály sú dostupné.
 * UI to používa aby ukázalo upozornenie keď ScrapingBee nie je nastavený.
 */
export async function GET() {
  const hasScrapingBee = !!process.env.SCRAPINGBEE_API_KEY;
  let credits: number | null = null;
  if (hasScrapingBee) {
    try {
      credits = await getScrapingBeeCredits();
    } catch {
      credits = null;
    }
  }

  return NextResponse.json({
    scrapingbee: {
      configured: hasScrapingBee,
      credits,
    },
    portals: {
      working: ["reality.sk", "bazos.sk"],
      needs_scrapingbee: ["nehnutelnosti.sk", "byty.sk", "topreality.sk"],
    },
  });
}
