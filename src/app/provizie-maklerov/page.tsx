"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function ProvizieMaklerovRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/tim?tab=provizie"); }, [router]);
  return null;
}
