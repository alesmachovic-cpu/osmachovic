// Tenké wrapper-y pre /api/klienti, /api/nabery, /api/inzerat/save a
// /api/obhliadky. Zachovávajú podobný shape ako supabase.from(...) odpoveď
// `{ error, data }` aby existujúce volania v UI mohli ostať takmer
// nezmenené po refactore.
//
// Ownership/role check beží v API endpointoch (viď src/lib/scope.ts).
// UI mám postupne prepisovať z direct supabase calls na tieto helpery,
// inak po sprísnení RLS (etapa D) nebude dať sa nič vytvoriť/upraviť.

type ApiResult<T> = { error: { message: string; code?: string } | null; data: T[] | null };

async function callJson<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  let r: Response;
  try {
    r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  } catch (e) {
    return { error: { message: (e as Error).message }, data: null };
  }
  let body: Record<string, unknown> = {};
  try { body = (await r.json()) as Record<string, unknown>; } catch { /* empty */ }
  if (!r.ok) {
    return {
      error: { message: String(body.error || `HTTP ${r.status}`), code: body.code as string | undefined },
      data: null,
    };
  }
  // Endpointy vracajú buď { klient: T } / { naber: T } / { obhliadka: T } / { id, data }.
  // Heuristika: vyber prvý hodnotu-objektu.
  const candidates = ["klient", "naber", "obhliadka", "data"];
  for (const k of candidates) {
    if (body[k] && typeof body[k] === "object") return { error: null, data: [body[k] as T] };
  }
  return { error: null, data: [body as unknown as T] };
}

/* ─── KLIENTI ────────────────────────────────────────────────────────── */

export function klientInsert<T = Record<string, unknown>>(
  userId: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<T>> {
  return callJson<T>("/api/klienti", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, ...payload }),
  });
}

export function klientUpdate<T = Record<string, unknown>>(
  userId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<ApiResult<T>> {
  return callJson<T>("/api/klienti", {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId, id, ...patch }),
  });
}

export function klientDelete(userId: string, id: string): Promise<ApiResult<unknown>> {
  return callJson<unknown>(`/api/klienti?id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

/* ─── NÁBEROVÝ LIST ──────────────────────────────────────────────────── */

export function naberInsert<T = Record<string, unknown>>(
  userId: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<T>> {
  return callJson<T>("/api/nabery", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, ...payload }),
  });
}

export function naberUpdate<T = Record<string, unknown>>(
  userId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<ApiResult<T>> {
  return callJson<T>("/api/nabery", {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId, id, ...patch }),
  });
}

export function naberDelete(userId: string, id: string): Promise<ApiResult<unknown>> {
  return callJson<unknown>(`/api/nabery?id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

/* ─── INZERÁT (NEHNUTEĽNOSŤ) ─────────────────────────────────────────── */

export function inzeratSave<T = Record<string, unknown>>(
  userId: string,
  payload: Record<string, unknown>,
  editId?: string,
): Promise<ApiResult<T>> {
  return callJson<T>("/api/inzerat/save", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, payload, ...(editId ? { editId } : {}) }),
  });
}
