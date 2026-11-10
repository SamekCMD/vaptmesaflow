import { useEffect, useState } from "react";
import { nextCatalogAvailabilityBoundary, type CatalogHours } from "@/lib/catalog/availability";
// UI-only clock: no transport, polling, or server wakeup. A single next boundary
// is enough; visibility/focus recomputes it after background suspension.
export function useCatalogAvailabilityClock(items: readonly CatalogHours[], enabled: boolean): void {
  const [, renderAt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer); timer = undefined;
      if (document.hidden) return;
      const now = new Date(); renderAt(now.getTime());
      const next = nextCatalogAvailabilityBoundary(items, now);
      if (next) timer = setTimeout(schedule, Math.max(1, next.getTime() - now.getTime()));
    };
    schedule(); document.addEventListener("visibilitychange", schedule); window.addEventListener("focus", schedule);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); window.removeEventListener("focus", schedule); };
  }, [items, enabled]);
}
