export default function WebNotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#F2F4F1", color: "#14202A", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#5B6770", fontWeight: 600 }}>Vianema</div>
        <h1 style={{ fontSize: 28, margin: "10px 0 8px" }}>Tento web zatiaľ nie je publikovaný</h1>
        <p style={{ color: "#5B6770", margin: 0 }}>Skúste to neskôr alebo navštívte <a href="https://www.vianemareal.eu" style={{ color: "#4F6F52", fontWeight: 600 }}>vianemareal.eu</a>.</p>
      </div>
    </div>
  );
}
