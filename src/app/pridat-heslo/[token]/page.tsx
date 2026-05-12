"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";

type TokenState = "loading" | "valid" | "invalid";

export default function PridatHesloPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [state, setState] = useState<TokenState>("loading");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/api/users/invite/accept?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setState("valid"); setUserName(d.userName); }
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Heslá sa nezhodujú"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Chyba"); return; }
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5EA] w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mb-1">VIANEMA</div>
          <div className="text-sm text-[#6e6e73]">CRM systém</div>
        </div>

        {state === "loading" && (
          <p className="text-center text-[#6e6e73] text-sm">Overujem odkaz…</p>
        )}

        {state === "invalid" && (
          <div className="text-center">
            <div className="text-4xl mb-4">🔒</div>
            <p className="font-medium text-[#1d1d1f] mb-2">Odkaz nie je platný</p>
            <p className="text-sm text-[#6e6e73]">Odkaz expiroval alebo bol už použitý. Požiadaj administrátora o novú pozvánku.</p>
          </div>
        )}

        {state === "valid" && !done && (
          <>
            <h1 className="text-xl font-semibold text-[#1d1d1f] mb-1">
              {userName ? `Ahoj, ${userName}` : "Nastav si heslo"}
            </h1>
            <p className="text-sm text-[#6e6e73] mb-6">Vytvor si heslo pre prihlásenie do CRM.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Nové heslo</label>
                <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimálne 10 znakov" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Potvrdiť heslo</label>
                <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Zopakuj heslo" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !password || !confirm}
                className="w-full bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {submitting ? "Ukladám…" : "Nastaviť heslo"}
              </button>
            </form>
          </>
        )}

        {done && (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="font-medium text-[#1d1d1f] mb-1">Heslo nastavené</p>
            <p className="text-sm text-[#6e6e73]">Presmerúvam ťa na CRM…</p>
          </div>
        )}
      </div>
    </div>
  );
}
