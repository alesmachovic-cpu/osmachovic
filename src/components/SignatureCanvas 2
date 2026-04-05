"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  onSignatureChange: (base64: string | null) => void;
}

export default function SignatureCanvas({ onSignatureChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#374151";
    }
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    setDrawing(true);
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPoint.current = { x: x * dpr, y: y * dpr };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    setDrawing(false);
    lastPoint.current = null;
    setHasSignature(true);
    const canvas = canvasRef.current!;
    onSignatureChange(canvas.toDataURL("image/png"));
  }

  function handleClear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSignature(false);
    onSignatureChange(null);
  }

  return (
    <div>
      <div style={{
        fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: "500",
      }}>
        Podpíšte sa prstom alebo myšou do poľa nižšie
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width: "100%", height: "160px",
          border: hasSignature ? "2px solid #374151" : "2px dashed var(--border)",
          borderRadius: "10px", cursor: "crosshair",
          touchAction: "none", background: "#FAFAFA",
        }}
      />
      {hasSignature && (
        <button onClick={handleClear} style={{
          marginTop: "8px", padding: "6px 14px", background: "var(--bg-elevated)",
          border: "1px solid var(--border)", borderRadius: "8px",
          fontSize: "12px", color: "var(--text-muted)", cursor: "pointer",
        }}>
          Vymazať podpis
        </button>
      )}
    </div>
  );
}
