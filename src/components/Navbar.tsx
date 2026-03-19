"use client";

export default function Navbar() {
  return (
    <header
      style={{
        height: "60px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      {/* Greeting */}
      <h1 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
        Dobrý deň, Peter 👋
      </h1>

      {/* Right: search + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "9px",
            padding: "7px 14px",
            width: "260px",
          }}
        >
          <svg width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Hľadať nehnuteľnosti, klientov..."
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "13px",
              color: "var(--text-primary)",
              width: "100%",
            }}
          />
        </div>

        {/* Notification bell */}
        <button
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "9px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-secondary)",
            position: "relative",
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span
            style={{
              position: "absolute",
              top: "7px",
              right: "7px",
              width: "7px",
              height: "7px",
              background: "var(--danger)",
              borderRadius: "50%",
              border: "1.5px solid var(--bg-surface)",
            }}
          />
        </button>

        {/* Avatar */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3B82F6, #6366F1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: "700",
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          PM
        </div>
      </div>
    </header>
  );
}
