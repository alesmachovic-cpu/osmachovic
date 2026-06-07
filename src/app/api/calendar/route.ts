import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";

// Google Calendar sa načítava cez MCP v Claude, ale pre frontend
// vytvoríme jednoduchý endpoint ktorý vráti hardcoded/cached eventy
// V budúcnosti sa napojí na Google Calendar API priamo

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  // Tieto eventy sa budú aktualizovať cez sync
  // Zatiaľ vrátime prázdne pole — widget si eventy stiahne priamo
  return NextResponse.json({ events: [] });
}
