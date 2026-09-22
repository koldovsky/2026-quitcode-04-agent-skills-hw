"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While the quote is queued or processing, re-render the server page every few seconds.
// The server component stops rendering this once the status is final.
export function QuoteStatusRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return <p className="text-xs text-slate-500">Сторінка оновлюється автоматично.</p>;
}
