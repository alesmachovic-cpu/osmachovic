"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", padding: "40px", textAlign: "center",
    }}>
      <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
      <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary, #111)", margin: "0 0 8px" }}>
        Nastala chyba
      </h2>
      <p style={{ fontSize: "13px", color: "var(--text-muted, #6B7280)", margin: "0 0 8px", maxWidth: "360px" }}>
        {error.message || "Neočakávaná chyba pri načítaní stránky."}
      </p>
<button
        onClick={reset}
        style={{
          padding: "10px 24px", background: "#374151", color: "#fff",
          border: "none", borderRadius: "10px", fontSize: "14px",
          fontWeight: "600", cursor: "pointer",
        }}
      >
        Skúsiť znova
      </button>
    </div>
  );
}
