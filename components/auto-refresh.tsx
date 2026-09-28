"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the server page (which reads the status from the DB, never from n8n) on a timer.
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
