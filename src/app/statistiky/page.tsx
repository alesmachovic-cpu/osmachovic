"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StatistikyPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/manazer"); }, [router]);
  return null;
}
