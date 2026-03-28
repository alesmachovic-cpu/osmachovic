"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

const MIME_ICONS: Record<string, string> = {
  "application/vnd.google-apps.folder": "&#128193;",
  "application/pdf": "&#128196;",
  "application/vnd.google-apps.document": "&#128196;",
  "application/vnd.google-apps.spreadsheet": "&#128202;",
  "application/vnd.google-apps.presentation": "&#128202;",
  "image/jpeg": "&#128247;",
  "image/png": "&#128247;",
  "video/mp4": "&#127910;",
};

function formatSize(bytes: string | undefined) {
  if (!bytes) return "";
  const b = parseInt(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DiskPage() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "Môj Disk" }]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/auth/google/status?userId=${user.id}`)
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected);
        if (d.connected) loadFiles(null);
        else setLoading(false);
      })
      .catch(() => { setConnected(false); setLoading(false); });
  }, [user?.id]);

  async function loadFiles(folder: string | null) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: user!.id });
      if (folder) params.set("folderId", folder);
      const res = await fetch(`/api/google/drive?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  function openFolder(file: DriveFile) {
    setFolderId(file.id);
    setFolderPath(prev => [...prev, { id: file.id, name: file.name }]);
    loadFiles(file.id);
  }

  function navigateTo(index: number) {
    const target = folderPath[index];
    setFolderPath(prev => prev.slice(0, index + 1));
    setFolderId(target.id);
    loadFiles(target.id);
  }

  function handleConnect() {
    if (!user?.id) return;
    window.location.href = `/api/auth/google?userId=${user.id}`;
  }

  if (loading && connected === null) {
    return (
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>Google Disk</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Načítavam...</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>Google Disk</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 32px" }}>Prepoj Google účet pre prístup k súborom</p>

        <div style={{
          maxWidth: "440px", margin: "0 auto", padding: "40px",
          background: "var(--bg-surface)", borderRadius: "16px",
          border: "1px solid var(--border)", textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#128193;</div>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px" }}>
            Pripoj Google Disk
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 24px" }}>
            Prihlás sa cez Google a uvidíš tu svoje súbory
          </p>
          <button onClick={handleConnect} style={{
            padding: "12px 32px", background: "#fff", color: "#374151",
            border: "1px solid #D1D5DB", borderRadius: "10px",
            fontSize: "14px", fontWeight: "600", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Prihlásiť sa cez Google
          </button>
        </div>
      </div>
    );
  }

  const folders = files.filter(f => f.mimeType === "application/vnd.google-apps.folder");
  const docs = files.filter(f => f.mimeType !== "application/vnd.google-apps.folder");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>Google Disk</h1>
          {/* Breadcrumb */}
          <div style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "13px" }}>
            {folderPath.map((p, i) => (
              <span key={i}>
                {i > 0 && <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>/</span>}
                <span
                  onClick={() => navigateTo(i)}
                  style={{
                    color: i === folderPath.length - 1 ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: i === folderPath.length - 1 ? "600" : "400",
                    cursor: i < folderPath.length - 1 ? "pointer" : "default",
                  }}
                >{p.name}</span>
              </span>
            ))}
          </div>
        </div>
        <button onClick={() => loadFiles(folderId)} style={{
          padding: "8px 16px", background: "var(--bg-surface)",
          border: "1px solid var(--border)", borderRadius: "8px",
          fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer",
        }}>Obnoviť</button>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Načítavam súbory...</div>
      ) : files.length === 0 ? (
        <div style={{
          padding: "40px", textAlign: "center", background: "var(--bg-surface)",
          borderRadius: "14px", border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Priečinok je prázdny</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {/* Folders first */}
          {folders.length > 0 && (
            <div style={{
              background: "var(--bg-surface)", borderRadius: "14px",
              border: "1px solid var(--border)", overflow: "hidden", marginBottom: "12px",
            }}>
              {folders.map((file, i) => (
                <div key={file.id} onClick={() => openFolder(file)} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 16px", cursor: "pointer",
                  borderBottom: i < folders.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.1s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: "20px" }} dangerouslySetInnerHTML={{ __html: "&#128193;" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{file.name}</div>
                  </div>
                  <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>&rsaquo;</span>
                </div>
              ))}
            </div>
          )}

          {/* Files */}
          {docs.length > 0 && (
            <div style={{
              background: "var(--bg-surface)", borderRadius: "14px",
              border: "1px solid var(--border)", overflow: "hidden",
            }}>
              {docs.map((file, i) => {
                const icon = MIME_ICONS[file.mimeType] || "&#128196;";
                let dateStr = "";
                try {
                  dateStr = new Date(file.modifiedTime).toLocaleDateString("sk", { day: "numeric", month: "short", year: "numeric" });
                } catch { dateStr = ""; }

                return (
                  <a key={file.id} href={file.webViewLink || "#"} target="_blank" rel="noopener"
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "12px 16px", textDecoration: "none",
                      borderBottom: i < docs.length - 1 ? "1px solid var(--border)" : "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontSize: "20px" }} dangerouslySetInnerHTML={{ __html: icon }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "13px", fontWeight: "500", color: "var(--text-primary)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{file.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {dateStr}{file.size ? ` · ${formatSize(file.size)}` : ""}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
