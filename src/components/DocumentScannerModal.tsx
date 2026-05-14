"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import jsPDF from "jspdf";

interface Props {
  open: boolean;
  onClose: () => void;
  docLabel: string;
  onSave: (pdfBase64: string, name: string) => void;
}

type Phase = "capture" | "crop";

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Returns dataURL JPEG 0.85 — crop z img, max 1600px resize, optional grayscale+contrast
function applyCropAndEnhance(
  img: HTMLImageElement,
  crop: CropRect,
  rotation: number,
  enhance: boolean
): string {
  const MAX = 1600;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Rotate in 90° steps
  const steps = ((rotation / 90) % 4 + 4) % 4;

  let srcW = img.naturalWidth;
  let srcH = img.naturalHeight;

  // Crop coords are in displayed (possibly rotated) space → convert to natural
  // We work with the crop in the display coordinate space, then back-project
  // Display canvas is always drawn with rotation applied, so crop rect is in rotated space.
  // We must undo the rotation to get natural image coords.

  // Aspect of rotated display
  const dispW = steps % 2 === 0 ? srcW : srcH;
  const dispH = steps % 2 === 0 ? srcH : srcW;

  // Crop in natural image coords
  const nx = (crop.x / dispW) * srcW;
  const ny = (crop.y / dispH) * srcH;
  const nw = (crop.w / dispW) * srcW;
  const nh = (crop.h / dispH) * srcH;

  // Scale down to MAX
  let outW = nw;
  let outH = nh;
  if (outW > MAX || outH > MAX) {
    const scale = Math.min(MAX / outW, MAX / outH);
    outW = outW * scale;
    outH = outH * scale;
  }

  // Apply rotation to the final canvas
  const finalW = steps % 2 === 0 ? outW : outH;
  const finalH = steps % 2 === 0 ? outH : outW;

  canvas.width = Math.round(finalW);
  canvas.height = Math.round(finalH);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(
    img,
    Math.round(nx), Math.round(ny), Math.round(nw), Math.round(nh),
    -outW / 2, -outH / 2, outW, outH
  );
  ctx.restore();

  if (enhance) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const contrast = 1.5;
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const adjusted = factor * (gray - 128) + 128;
      const clamped = Math.min(255, Math.max(0, adjusted));
      data[i] = clamped;
      data[i + 1] = clamped;
      data[i + 2] = clamped;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function DocumentScannerModal({ open, onClose, docLabel, onSave }: Props) {
  const [phase, setPhase] = useState<Phase>("capture");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [enhance, setEnhance] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [draggingHandle, setDraggingHandle] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw the crop overlay onto canvas whenever img/crop/rotation/enhance changes
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const steps = ((rotation / 90) % 4 + 4) % 4;
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;

    // Displayed dimensions after rotation
    const dispW = steps % 2 === 0 ? srcW : srcH;
    const dispH = steps % 2 === 0 ? srcH : srcW;

    // Fit into canvas container
    const maxW = canvas.parentElement?.clientWidth || 400;
    const maxH = window.innerHeight * 0.5;
    const scale = Math.min(maxW / dispW, maxH / dispH, 1);
    const cW = Math.round(dispW * scale);
    const cH = Math.round(dispH * scale);

    canvas.width = cW;
    canvas.height = cH;

    ctx.save();
    ctx.translate(cW / 2, cH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const dW = steps % 2 === 0 ? cW : cH;
    const dH = steps % 2 === 0 ? cH : cW;
    ctx.drawImage(img, -dW / 2, -dH / 2, dW, dH);
    ctx.restore();

    if (enhance) {
      const imageData = ctx.getImageData(0, 0, cW, cH);
      const data = imageData.data;
      const contrast = 1.5;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const adjusted = factor * (gray - 128) + 128;
        const clamped = Math.min(255, Math.max(0, adjusted));
        data[i] = clamped;
        data[i + 1] = clamped;
        data[i + 2] = clamped;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Crop overlay
    const cx = cropRect.x * scale;
    const cy = cropRect.y * scale;
    const cw = cropRect.w * scale;
    const ch = cropRect.h * scale;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    // top
    ctx.fillRect(0, 0, cW, cy);
    // bottom
    ctx.fillRect(0, cy + ch, cW, cH - cy - ch);
    // left
    ctx.fillRect(0, cy, cx, ch);
    // right
    ctx.fillRect(cx + cw, cy, cW - cx - cw, ch);

    // Border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx, cy, cw, ch);
  }, [rotation, enhance, cropRect]);

  useEffect(() => {
    if (phase === "crop") drawCanvas();
  }, [phase, drawCanvas]);

  function resetCropToFull(img: HTMLImageElement) {
    const steps = ((rotation / 90) % 4 + 4) % 4;
    const dispW = steps % 2 === 0 ? img.naturalWidth : img.naturalHeight;
    const dispH = steps % 2 === 0 ? img.naturalHeight : img.naturalWidth;
    setCropRect({ x: 0, y: 0, w: dispW, h: dispH });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      resetCropToFull(img);
      setPhase("crop");
    };
    img.src = url;
    e.target.value = "";
  }

  function handleRotate(deg: number) {
    const newRot = (rotation + deg + 360) % 360;
    setRotation(newRot);
    if (imgRef.current) {
      const img = imgRef.current;
      const steps = ((newRot / 90) % 4 + 4) % 4;
      const dispW = steps % 2 === 0 ? img.naturalWidth : img.naturalHeight;
      const dispH = steps % 2 === 0 ? img.naturalHeight : img.naturalWidth;
      setCropRect({ x: 0, y: 0, w: dispW, h: dispH });
    }
  }

  function getCanvasScale(): number {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return 1;
    const steps = ((rotation / 90) % 4 + 4) % 4;
    const dispW = steps % 2 === 0 ? img.naturalWidth : img.naturalHeight;
    return canvas.width / dispW;
  }

  function handlePointerDown(handleIdx: number) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      setDraggingHandle(handleIdx);
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (draggingHandle === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = getCanvasScale();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    const img = imgRef.current;
    if (!img) return;
    const steps = ((rotation / 90) % 4 + 4) % 4;
    const maxW = steps % 2 === 0 ? img.naturalWidth : img.naturalHeight;
    const maxH = steps % 2 === 0 ? img.naturalHeight : img.naturalWidth;

    setCropRect(prev => {
      let { x, y, w, h } = prev;
      const MIN = 40;
      switch (draggingHandle) {
        case 0: { // top-left
          const nx = Math.min(mx, x + w - MIN);
          const ny = Math.min(my, y + h - MIN);
          const nw = w + (x - nx);
          const nh = h + (y - ny);
          return { x: Math.max(0, nx), y: Math.max(0, ny), w: nw, h: nh };
        }
        case 1: { // top-right
          const ny = Math.min(my, y + h - MIN);
          const nw = Math.max(MIN, mx - x);
          const nh = h + (y - ny);
          return { x, y: Math.max(0, ny), w: Math.min(nw, maxW - x), h: nh };
        }
        case 2: { // bottom-left
          const nx = Math.min(mx, x + w - MIN);
          const nw = w + (x - nx);
          const nh = Math.max(MIN, my - y);
          return { x: Math.max(0, nx), y, w: nw, h: Math.min(nh, maxH - y) };
        }
        case 3: { // bottom-right
          const nw = Math.max(MIN, mx - x);
          const nh = Math.max(MIN, my - y);
          return { x, y, w: Math.min(nw, maxW - x), h: Math.min(nh, maxH - y) };
        }
        default: return prev;
      }
    });
  }

  function handlePointerUp() {
    setDraggingHandle(null);
  }

  function handleApplyCrop() {
    const img = imgRef.current;
    if (!img) return;
    const dataUrl = applyCropAndEnhance(img, cropRect, rotation, enhance);
    setPages(prev => [...prev, dataUrl]);
    setPhase("capture");
    setImgSrc(null);
    setRotation(0);
    setEnhance(false);
  }

  function removePage(idx: number) {
    setPages(prev => prev.filter((_, i) => i !== idx));
  }

  function handleAddPage() {
    fileInputRef.current?.click();
  }

  function handleExportPDF() {
    if (pages.length === 0) return;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const PAD = 5;
    const pageW = 210;
    const pageH = 297;
    const availW = pageW - PAD * 2;
    const availH = pageH - PAD * 2;

    pages.forEach((dataUrl, i) => {
      if (i > 0) pdf.addPage();
      // Load image to get dimensions
      const tmp = new Image();
      tmp.src = dataUrl;
      const iw = tmp.naturalWidth || 800;
      const ih = tmp.naturalHeight || 600;
      const scale = Math.min(availW / iw, availH / ih);
      const w = iw * scale;
      const h = ih * scale;
      const x = PAD + (availW - w) / 2;
      const y = PAD + (availH - h) / 2;
      pdf.addImage(dataUrl, "JPEG", x, y, w, h);
    });

    const dataUri = pdf.output("datauristring");
    const base64 = dataUri.split(",")[1];
    const ts = new Date().toISOString().slice(0, 10);
    const name = `${docLabel.replace(/\s+/g, "_")}_${ts}.pdf`;
    onSave(base64, name);
  }

  function handleClose() {
    setPhase("capture");
    setImgSrc(null);
    setPages([]);
    setRotation(0);
    setEnhance(false);
    setCropRect({ x: 0, y: 0, w: 0, h: 0 });
    onClose();
  }

  if (!open) return null;

  const scale = getCanvasScale();

  // Handle positions in canvas display coords
  const handlePositions: { x: number; y: number }[] = canvasRef.current
    ? [
        { x: cropRect.x * scale, y: cropRect.y * scale },
        { x: (cropRect.x + cropRect.w) * scale, y: cropRect.y * scale },
        { x: cropRect.x * scale, y: (cropRect.y + cropRect.h) * scale },
        { x: (cropRect.x + cropRect.w) * scale, y: (cropRect.y + cropRect.h) * scale },
      ]
    : [];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "#fff",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: "1px solid #E5E7EB",
        background: "#fff",
      }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>Skenovať dokument</div>
          <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>{docLabel}</div>
        </div>
        <button
          onClick={handleClose}
          style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: "#F3F4F6", border: "none", cursor: "pointer",
            fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

        {/* Phase: capture */}
        {phase === "capture" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            {pages.length > 0 && (
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "10px" }}>
                  Strany ({pages.length})
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {pages.map((pg, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img
                        src={pg}
                        alt={`Strana ${i + 1}`}
                        style={{ width: "72px", height: "96px", objectFit: "cover", borderRadius: "8px", border: "1px solid #E5E7EB" }}
                      />
                      <div style={{
                        position: "absolute", bottom: "2px", left: "0", right: "0",
                        textAlign: "center", fontSize: "10px", color: "#fff",
                        background: "rgba(0,0,0,0.5)", borderRadius: "0 0 7px 7px", padding: "2px 0",
                      }}>
                        {i + 1}
                      </div>
                      <button
                        onClick={() => removePage(i)}
                        style={{
                          position: "absolute", top: "-6px", right: "-6px",
                          width: "20px", height: "20px", borderRadius: "50%",
                          background: "#EF4444", color: "#fff", border: "none",
                          fontSize: "11px", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              width: "100%", maxWidth: "320px",
              border: "2px dashed #D1D5DB", borderRadius: "16px",
              padding: "32px 20px", textAlign: "center",
              background: "#F9FAFB",
            }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📷</div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "8px" }}>
                {pages.length === 0 ? "Naskenuj dokument" : "Pridať ďalšiu stranu"}
              </div>
              <div style={{ fontSize: "12px", color: "#9CA3AF", marginBottom: "16px" }}>
                Odfot dokument alebo vyber súbor
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: "10px 24px", borderRadius: "10px", border: "none",
                  background: "#374151", color: "#fff", fontSize: "14px",
                  fontWeight: "600", cursor: "pointer",
                }}
              >
                {pages.length === 0 ? "Odfotiť / vybrať" : "Pridať stranu"}
              </button>
            </div>
          </div>
        )}

        {/* Phase: crop */}
        {phase === "crop" && imgSrc && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => handleRotate(-90)}
                style={{
                  padding: "8px 14px", borderRadius: "8px", border: "1px solid #E5E7EB",
                  background: "#F9FAFB", fontSize: "16px", cursor: "pointer",
                }}
                title="Otočiť doľava"
              >
                ↺
              </button>
              <button
                onClick={() => handleRotate(90)}
                style={{
                  padding: "8px 14px", borderRadius: "8px", border: "1px solid #E5E7EB",
                  background: "#F9FAFB", fontSize: "16px", cursor: "pointer",
                }}
                title="Otočiť doprava"
              >
                ↻
              </button>
              <label style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 14px", borderRadius: "8px",
                border: enhance ? "1.5px solid #374151" : "1px solid #E5E7EB",
                background: enhance ? "#374151" : "#F9FAFB",
                color: enhance ? "#fff" : "#374151",
                cursor: "pointer", fontSize: "13px", fontWeight: "600",
              }}>
                <input
                  type="checkbox"
                  checked={enhance}
                  onChange={e => setEnhance(e.target.checked)}
                  style={{ display: "none" }}
                />
                Dokument mód
              </label>
            </div>

            {/* Canvas + handles */}
            <div
              ref={containerRef}
              style={{ position: "relative", display: "inline-block", width: "100%" }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <canvas ref={canvasRef} style={{ display: "block", width: "100%", borderRadius: "8px" }} />

              {/* 4 crop handles */}
              {handlePositions.map((pos, idx) => (
                <div
                  key={idx}
                  onPointerDown={handlePointerDown(idx)}
                  style={{
                    position: "absolute",
                    left: pos.x - 22,
                    top: pos.y - 22,
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.9)",
                    border: "2.5px solid #374151",
                    cursor: "crosshair",
                    zIndex: 10,
                    touchAction: "none",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "16px 20px", borderTop: "1px solid #E5E7EB",
        background: "#fff", display: "flex", gap: "10px", flexWrap: "wrap",
      }}>
        {phase === "crop" && (
          <>
            <button
              onClick={() => { setPhase("capture"); setImgSrc(null); setRotation(0); setEnhance(false); }}
              style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                border: "1px solid #E5E7EB", background: "#F9FAFB",
                fontSize: "14px", fontWeight: "600", cursor: "pointer", color: "#374151",
              }}
            >
              Zrušiť
            </button>
            <button
              onClick={handleApplyCrop}
              style={{
                flex: 2, padding: "12px", borderRadius: "10px",
                border: "none", background: "#374151", color: "#fff",
                fontSize: "14px", fontWeight: "700", cursor: "pointer",
              }}
            >
              Použiť orez
            </button>
          </>
        )}

        {phase === "capture" && pages.length > 0 && (
          <>
            <button
              onClick={handleAddPage}
              style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                border: "1px solid #E5E7EB", background: "#F9FAFB",
                fontSize: "14px", fontWeight: "600", cursor: "pointer", color: "#374151",
              }}
            >
              Pridať stranu
            </button>
            <button
              onClick={handleExportPDF}
              style={{
                flex: 2, padding: "12px", borderRadius: "10px",
                border: "none", background: "#16A34A", color: "#fff",
                fontSize: "14px", fontWeight: "700", cursor: "pointer",
              }}
            >
              Uložiť PDF ({pages.length} str.)
            </button>
          </>
        )}

        {phase === "capture" && pages.length === 0 && (
          <button
            onClick={handleClose}
            style={{
              flex: 1, padding: "12px", borderRadius: "10px",
              border: "1px solid #E5E7EB", background: "#F9FAFB",
              fontSize: "14px", fontWeight: "600", cursor: "pointer", color: "#374151",
            }}
          >
            Zavrieť
          </button>
        )}
      </div>
    </div>
  );
}
