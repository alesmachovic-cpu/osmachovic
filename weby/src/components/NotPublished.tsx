export default function NotPublished() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>Vianema</div>
        <h1 style={{ fontSize: 28, margin: "10px 0 8px", fontWeight: 600 }}>Tento web zatiaľ nie je publikovaný</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>Skúste to neskôr alebo navštívte <a href="https://www.vianemareal.eu" style={{ fontWeight: 600 }}>vianemareal.eu</a>.</p>
      </div>
    </div>
  );
}
