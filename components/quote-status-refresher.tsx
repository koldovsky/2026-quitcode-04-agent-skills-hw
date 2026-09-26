"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 5_000;
// The workflow takes 40–90 s; five minutes without a result means the callback is not coming.
const GIVE_UP_AFTER_MS = 5 * 60_000;

// Re-renders the server page while the quote is still in progress, and stops polling once the
// quote is clearly stuck, so an abandoned tab does not hit the server forever.
export function QuoteStatusRefresher({ createdAt }: { createdAt: string }) {
  const router = useRouter();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const deadline = Date.parse(createdAt) + GIVE_UP_AFTER_MS;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (Date.now() > deadline) {
        setStalled(true);
        return;
      }
      router.refresh();
      timer = setTimeout(tick, REFRESH_MS);
    };
    timer = setTimeout(tick, REFRESH_MS);
    return () => clearTimeout(timer);
  }, [router, createdAt]);

  return (
    <p role="status" className="text-sm text-slate-500">
      {stalled
        ? "Кошторис готується довше, ніж зазвичай. Сторінка більше не оновлюється сама — зазирніть пізніше або напишіть нам."
        : "Сторінка оновлюється сама."}
    </p>
  );
}
