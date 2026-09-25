"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Кошторис готується 40–90 с. Поки запис "queued", періодично оновлюємо сторінку,
// щоб побачити результат колбека без ручного перезавантаження. n8n тут не викликаємо.
export function QuoteStatusPoller() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
