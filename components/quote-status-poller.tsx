"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 5_000;

// Refreshes the server-rendered status page while the n8n workflow is still
// running, so a visitor left on the page sees the result without a manual
// reload once the callback route updates the quote.
export function QuoteStatusPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
