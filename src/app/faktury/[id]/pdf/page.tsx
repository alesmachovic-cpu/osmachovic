"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function FakturaPdfPage() {
  const params = useParams<{ id: string }>();
  const pdfUrl = `/api/faktury/pdf?id=${params.id}`;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(pdfUrl, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      })
      .then(blob => setBlobUrl(URL.createObjectURL(blob)))
      .catch(() => setErr(true));
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1a1a1a" }}>
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

      {blobUrl ? (
        <iframe
          src={blobUrl}
          style={{ flex: 1, border: "none", width: "100%" }}
          title="Faktúra PDF"
        />
      ) : err ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", color: "rgba(255,255,255,0.6)" }}>
          <div style={{ fontSize: "40px" }}>📄</div>
          <div style={{ fontSize: "14px" }}>Náhľad nie je dostupný — použi tlačidlo Stiahnuť</div>
          <a href={pdfUrl} download style={{ padding: "10px 20px", borderRadius: "10px", background: "#3b82f6", color: "#fff", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
            ⬇ Stiahnuť PDF
          </a>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
          Načítavam PDF...
        </div>
      )}
    </div>
  );
}
