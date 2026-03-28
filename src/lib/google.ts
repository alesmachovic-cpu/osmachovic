import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function getGoogleAuthUrl(userId: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }>;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json();
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("users")
    .select("google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", userId)
    .single();

  if (!data?.google_refresh_token) return null;

  const now = Math.floor(Date.now() / 1000);
  // If token expires in less than 5 minutes, refresh
  if (!data.google_access_token || (data.google_token_expires_at && data.google_token_expires_at < now + 300)) {
    try {
      const refreshed = await refreshAccessToken(data.google_refresh_token);
      const expiresAt = now + refreshed.expires_in;
      await sb
        .from("users")
        .update({
          google_access_token: refreshed.access_token,
          google_token_expires_at: expiresAt,
        })
        .eq("id", userId);
      return refreshed.access_token;
    } catch {
      return null;
    }
  }

  return data.google_access_token;
}

export async function saveTokens(
  userId: string,
  tokens: { access_token: string; refresh_token?: string; expires_in: number },
  googleEmail: string
) {
  const sb = supabaseAdmin();
  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;
  const update: Record<string, unknown> = {
    google_access_token: tokens.access_token,
    google_token_expires_at: expiresAt,
    google_email: googleEmail,
  };
  if (tokens.refresh_token) {
    update.google_refresh_token = tokens.refresh_token;
  }
  await sb.from("users").update(update).eq("id", userId);
}

export async function disconnectGoogle(userId: string) {
  const sb = supabaseAdmin();
  await sb.from("users").update({
    google_access_token: null,
    google_refresh_token: null,
    google_token_expires_at: null,
    google_email: null,
  }).eq("id", userId);
}
