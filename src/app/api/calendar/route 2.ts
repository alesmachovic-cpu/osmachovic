import { NextResponse } from "next/server";

// Google Calendar sa načítava cez MCP v Claude, ale pre frontend
// vytvoríme jednoduchý endpoint ktorý vráti hardcoded/cached eventy
// V budúcnosti sa napojí na Google Calendar API priamo

export async function GET() {
  // Tieto eventy sa budú aktualizovať cez sync
  // Zatiaľ vrátime prázdne pole — widget si eventy stiahne priamo
  return NextResponse.json({ events: [] });
}
