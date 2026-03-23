"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AIWriterRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/inzerat"); }, [router]);
  return (
    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
      Presmerovanie na Tvorbu inzerátu...
    </div>
  );
}
