"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While the quote is still queued, re-fetch the Server Component every few seconds so the
// page flips to "ready"/"failed" on its own once the n8n callback updates our record.
export function QuoteStatusRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
