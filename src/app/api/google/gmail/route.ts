import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const token = await getValidAccessToken(userId);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    // Fetch latest 20 messages
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) {
      const err = await listRes.text();
      console.error("[gmail] list error:", err);
      return NextResponse.json({ error: "gmail_error" }, { status: 500 });
    }
    const listData = await listRes.json();
    const messageIds = (listData.messages || []) as { id: string }[];

    // Fetch each message details (batch)
    const emails = await Promise.all(
      messageIds.slice(0, 20).map(async (msg) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) return null;
        const msgData = await msgRes.json();

        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value || "";

        return {
          id: msgData.id,
          threadId: msgData.threadId,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          snippet: msgData.snippet || "",
          read: !(msgData.labelIds || []).includes("UNREAD"),
        };
      })
    );

    return NextResponse.json({ emails: emails.filter(Boolean) });
  } catch (e) {
    console.error("[gmail]", e);
    return NextResponse.json({ error: "gmail_error" }, { status: 500 });
  }
}
