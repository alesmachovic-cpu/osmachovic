"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function VytazenostRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/tim?tab=vytazenost"); }, [router]);
  return null;
}
