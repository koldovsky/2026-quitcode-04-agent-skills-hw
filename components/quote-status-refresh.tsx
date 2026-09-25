"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 3_000;
// The workflow takes up to ~90 s; after this we tell the client it is slower than usual.
const SLOW_AFTER_MS = 3 * 60 * 1000;

// Rendered only while the quote is queued/processing: re-reads the Server Component until it is final.
export function QuoteStatusRefresh({ createdAt }: { createdAt: string }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const check = () => setSlow(Date.now() - Date.parse(createdAt) > SLOW_AFTER_MS);
    check();
    const timer = setInterval(() => {
      check();
      router.refresh();
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router, createdAt]);

  if (!slow) return null;
  return (
    <p className="text-amber-700">
      Цього разу довше, ніж зазвичай. Можна закрити сторінку й повернутися за цим посиланням пізніше.
    </p>
  );
}
