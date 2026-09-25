"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 3_000;
// The workflow takes up to ~90 s; after this we tell the client it is slower than usual.
const SLOW_AFTER_MS = 3 * 60 * 1000;
// If no callback came by now it will not come by itself (n8n gave up or the workflow failed): stop polling.
const STOP_AFTER_MS = 15 * 60 * 1000;

// Rendered only while the quote is queued/processing: re-reads the Server Component until it is final.
export function QuoteStatusRefresh({ createdAt }: { createdAt: string }) {
  const router = useRouter();
  const [age, setAge] = useState<"fresh" | "slow" | "stalled">("fresh");

  useEffect(() => {
    const update = () => {
      const ms = Date.now() - Date.parse(createdAt);
      const next = ms > STOP_AFTER_MS ? "stalled" : ms > SLOW_AFTER_MS ? "slow" : "fresh";
      setAge(next);
      return next;
    };
    if (update() === "stalled") return;
    const timer = setInterval(() => {
      if (update() === "stalled") clearInterval(timer);
      else router.refresh();
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router, createdAt]);

  if (age === "fresh") return null;
  return (
    <p className="text-amber-700">
      {age === "slow"
        ? "Цього разу довше, ніж зазвичай. Можна закрити сторінку й повернутися за цим посиланням пізніше."
        : "Кошторис досі не готовий. Оновіть сторінку пізніше або надішліть запит ще раз — менеджер отримає обидва."}
    </p>
  );
}
