"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

export default function FakturaPdfPage() {
  const params = useParams<{ id: string }>();
  const pdfUrl = `/api/faktury/pdf?id=${params.id}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1a1a1a" }}>
      {/* Header s späť buttonom */}
      <div style={{
        display: "flex", alignItems: "center", gap: "16px",
        padding: "10px 20px",
        background: "#2a2a2a",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        flexShrink: 0,
      }}>
        <Link
          href={`/faktury/${params.id}`}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            color: "rgba(255,255,255,0.8)", textDecoration: "none",
            fontSize: "13px", fontWeight: 600,
            padding: "6px 12px", borderRadius: "8px",
            background: "rgba(255,255,255,0.1)",
            transition: "background 0.15s",
          }}
        >
          ← Späť na faktúru
        </Link>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>PDF náhľad</span>
        <a
          href={pdfUrl}
          download
          style={{
            marginLeft: "auto",
            display: "flex", alignItems: "center", gap: "6px",
            color: "rgba(255,255,255,0.8)", textDecoration: "none",
            fontSize: "13px", fontWeight: 600,
            padding: "6px 12px", borderRadius: "8px",
            background: "rgba(255,255,255,0.1)",
          }}
        >
          ⬇ Stiahnuť
        </a>
      </div>

      {/* PDF iframe */}
      <iframe
        src={pdfUrl}
        style={{ flex: 1, border: "none", width: "100%" }}
        title="Faktúra PDF"
      />
    </div>
  );
}
