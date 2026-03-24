"use client";

import { useState, useEffect } from "react";

interface MockEmail {
  id: string;
  from: string;
  email: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
}

const MOCK_EMAILS: MockEmail[] = [
  {
    id: "1",
    from: "Ján Horváth",
    email: "jan.horvath@gmail.com",
    subject: "Záujem o byt na Dunajskej",
    body: "Dobrý deň pán Machovič,\n\nmám záujem o 3-izbový byt na Dunajskej ulici, ktorý ste inzerovali. Mohli by sme sa dohodnúť na obhliadke tento týždeň?\n\nĎakujem a s pozdravom,\nJán Horváth",
    date: "2026-03-24T09:15:00",
    read: false,
  },
  {
    id: "2",
    from: "Mária Kováčová",
    email: "maria.kovacova@outlook.sk",
    subject: "Podpísaná zmluva - potvrdenie",
    body: "Dobrý deň,\n\nposielam potvrdenie o podpísaní sprostredkovateľskej zmluvy. Scan nájdete v prílohe. Prosím o ďalšie pokyny ohľadom inzercie.\n\nS pozdravom,\nMária Kováčová",
    date: "2026-03-24T08:30:00",
    read: false,
  },
  {
    id: "3",
    from: "Peter Novák",
    email: "peter.novak@firma.sk",
    subject: "Otázka k cene nehnuteľnosti na Kolibe",
    body: "Dobrý deň,\n\nchcel by som sa opýtať, či je cena 285 000 EUR za byt na Kolibe konečná, alebo je priestor na vyjednávanie. Mám predschválený úver do 270 000 EUR.\n\nĎakujem za odpoveď.\nPeter Novák",
    date: "2026-03-23T16:45:00",
    read: true,
  },
  {
    id: "4",
    from: "Eva Tóthová",
    email: "eva.tothova@gmail.com",
    subject: "Re: Obhliadka - zmena termínu",
    body: "Pán Machovič,\n\nbohužiaľ zajtra o 14:00 nemôžem. Vedeli by ste v stredu popoludní? Ideálne medzi 15:00 - 17:00.\n\nĎakujem za pochopenie,\nEva Tóthová",
    date: "2026-03-23T14:20:00",
    read: true,
  },
  {
    id: "5",
    from: "Tomáš Baláž",
    email: "tomas.balaz@email.sk",
    subject: "Znalecký posudok - hotový",
    body: "Dobrý deň,\n\nznalecký posudok na nehnuteľnosť na Vajnorskej je hotový. Hodnota bola stanovená na 195 000 EUR. Posudok Vám doručím osobne zajtra.\n\nS pozdravom,\nIng. Tomáš Baláž, znalec",
    date: "2026-03-22T11:00:00",
    read: true,
  },
  {
    id: "6",
    from: "Lucia Šimková",
    email: "lucia.simkova@centrum.sk",
    subject: "Hľadám 2-izbový byt v Petržalke",
    body: "Dobrý deň,\n\ndostala som odporúčanie od kamarátky. Hľadám 2-izbový byt v Petržalke, ideálne do 150 000 EUR. Máte niečo v ponuke?\n\nĎakujem,\nLucia Šimková",
    date: "2026-03-22T09:10:00",
    read: true,
  },
];

export default function GmailPage() {
  const [gmailAddress, setGmailAddress] = useState("");
  const [configured, setConfigured] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [emails, setEmails] = useState<MockEmail[]>(MOCK_EMAILS);

  useEffect(() => {
    const stored = localStorage.getItem("os_gmail_address");
    if (stored) {
      setGmailAddress(stored);
      setConfigured(true);
    }
  }, []);

  function handleSetup() {
    if (!inputValue.trim()) return;
    localStorage.setItem("os_gmail_address", inputValue.trim());
    setGmailAddress(inputValue.trim());
    setConfigured(true);
  }

  function handleDisconnect() {
    localStorage.removeItem("os_gmail_address");
    setGmailAddress("");
    setConfigured(false);
    setInputValue("");
  }

  function markAsRead(id: string) {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, read: true } : e))
    );
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
    markAsRead(id);
  }

  const unreadCount = emails.filter((e) => !e.read).length;

  // Setup screen
  if (!configured) {
    return (
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
          Gmail integrácia
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 32px" }}>
          Prepojte svoj Gmail účet pre zobrazenie emailov
        </p>

        <div style={{
          maxWidth: "440px",
          margin: "0 auto",
          padding: "40px",
          background: "var(--bg-surface)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#9993;</div>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px" }}>
            Nastavenie Gmail
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 24px" }}>
            Zadajte svoju Gmail adresu pre prepojenie s CRM
          </p>
          <input
            type="email"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="vas@gmail.com"
            onKeyDown={(e) => e.key === "Enter" && handleSetup()}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              fontSize: "14px",
              color: "var(--text-primary)",
              outline: "none",
              marginBottom: "16px",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleSetup}
            style={{
              width: "100%",
              padding: "12px",
              background: "#374151",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
            }}
          >
            Pripojiť Gmail
          </button>
        </div>
      </div>
    );
  }

  // Email inbox
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
            Gmail integrácia
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            {gmailAddress} &middot; {unreadCount > 0 ? `${unreadCount} neprečítaných` : "Všetky prečítané"}
          </p>
        </div>
        <button
          onClick={handleDisconnect}
          style={{
            padding: "8px 16px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Odpojiť
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Celkom emailov", value: emails.length },
          { label: "Neprečítané", value: unreadCount },
          { label: "Dnes", value: emails.filter((e) => e.date.startsWith("2026-03-24")).length },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "16px",
              background: "var(--bg-surface)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>
              {s.label}
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#374151" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Email list */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
        {emails.map((email, i) => (
          <div key={email.id}>
            <div
              onClick={() => toggleExpand(email.id)}
              style={{
                padding: "14px 20px",
                borderBottom: i < emails.length - 1 && expandedId !== email.id ? "1px solid var(--border)" : "none",
                cursor: "pointer",
                background: !email.read ? "rgba(55, 65, 81, 0.03)" : "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = !email.read ? "rgba(55, 65, 81, 0.03)" : "transparent")
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* Unread dot */}
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: !email.read ? "#374151" : "transparent",
                    flexShrink: 0,
                  }}
                />
                {/* Avatar */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#374151",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {email.from
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: !email.read ? "700" : "600",
                        color: "var(--text-primary)",
                      }}
                    >
                      {email.from}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0, marginLeft: "12px" }}>
                      {new Date(email.date).toLocaleDateString("sk", { day: "numeric", month: "short" })}{" "}
                      {new Date(email.date).toLocaleTimeString("sk", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: !email.read ? "600" : "400",
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {email.subject}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: "2px",
                    }}
                  >
                    {email.body.split("\n")[0]}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded body */}
            {expandedId === email.id && (
              <div
                style={{
                  padding: "0 20px 16px 76px",
                  borderBottom: i < emails.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    background: "var(--bg-elevated)",
                    borderRadius: "10px",
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    marginBottom: "12px",
                  }}
                >
                  {email.body}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <a
                    href={`mailto:${email.email}?subject=Re: ${encodeURIComponent(email.subject)}`}
                    style={{
                      padding: "8px 16px",
                      background: "#374151",
                      color: "#fff",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "600",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    Odpovedať
                  </a>
                  <a
                    href={`mailto:${email.email}?subject=Fwd: ${encodeURIComponent(email.subject)}`}
                    style={{
                      padding: "8px 16px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "600",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    Preposlať
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
