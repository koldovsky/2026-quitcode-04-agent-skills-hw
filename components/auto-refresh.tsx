"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the current Server Component page every few seconds while mounted, at most maxRefreshes
// times: if the callback never comes, the tab stops polling (60 × 5 s = 5 min; the workflow takes 40–90 s).
export function AutoRefresh({ intervalMs = 5_000, maxRefreshes = 60 }: { intervalMs?: number; maxRefreshes?: number }) {
  const router = useRouter();

  useEffect(() => {
    let refreshes = 0;
    const timer = setInterval(() => {
      router.refresh();
      refreshes += 1;
      if (refreshes >= maxRefreshes) clearInterval(timer);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, maxRefreshes]);

  return null;
}
