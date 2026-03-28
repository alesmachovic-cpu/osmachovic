import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const folderId = req.nextUrl.searchParams.get("folderId");

  const token = await getValidAccessToken(userId);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    let query = "trashed = false";
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }

    const params = new URLSearchParams({
      q: query,
      fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,thumbnailLink,parents)",
      orderBy: "modifiedTime desc",
      pageSize: "50",
    });

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[drive] error:", err);
      return NextResponse.json({ error: "drive_error" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ files: data.files || [] });
  } catch (e) {
    console.error("[drive]", e);
    return NextResponse.json({ error: "drive_error" }, { status: 500 });
  }
}
