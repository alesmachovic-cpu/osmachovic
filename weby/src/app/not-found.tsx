import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>Stránka nenájdená</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}><Link href="/">Späť na úvod</Link></p>
      </div>
    </div>
  );
}
