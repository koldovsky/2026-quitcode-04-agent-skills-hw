"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_MS = 3000;

// Rendered only while the quote is queued or processing: re-renders the Server Component page on a
// timer. The page reads the status from the app's store; n8n's callback is the only source of the
// result, so nothing here talks to n8n.
export function QuoteStatusRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
