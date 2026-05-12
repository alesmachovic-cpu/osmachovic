"use client";

import { useRouter } from "next/navigation";

interface Props {
  href?: string;
  label?: string;
}

export default function BackButton({ href, label = "← Späť" }: Props) {
  const router = useRouter();

  return (
    <button
      onClick={() => href ? router.push(href) : router.back()}
      style={{
        marginBottom: "16px", padding: "6px 12px", background: "transparent",
        border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px",
        color: "var(--text-secondary)", cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
