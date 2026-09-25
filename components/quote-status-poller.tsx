"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Кошторис готується 40–90 с. Поки запис "queued", періодично оновлюємо сторінку,
// щоб побачити результат колбека без ручного перезавантаження. n8n тут не викликаємо.
// Не довше за stopAfterMs: якщо колбека так і немає, сторінка показує «відповіді ще немає».
export function QuoteStatusPoller({ stopAfterMs }: { stopAfterMs: number }) {
  const router = useRouter();

  useEffect(() => {
    if (stopAfterMs <= 0) return;
    const timer = setInterval(() => router.refresh(), 5000);
    const stop = setTimeout(() => {
      clearInterval(timer);
      router.refresh(); // last render switches the page to the "no answer yet" message
    }, stopAfterMs);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [router, stopAfterMs]);

  return null;
}
