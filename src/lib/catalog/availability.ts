export type CatalogHours = { availableFrom?: string | null; availableUntil?: string | null };
export function isCatalogWithinHours(from?: string | null, until?: string | null, now = new Date()): boolean {
  if (!from && !until) return true;
  const minute = (value: string) => { const [hour, minutes] = value.split(":").map(Number); return hour * 60 + (minutes || 0); };
  const current = now.getHours() * 60 + now.getMinutes();
  const start = from ? minute(from) : 0; const end = until ? minute(until) : 1439;
  return from && until && start > end ? current >= start || current <= end : current >= start && current <= end;
}
export function nextCatalogAvailabilityBoundary(items: readonly CatalogHours[], now: Date): Date | null {
  let next: Date | null = null;
  for (const item of items) {
    if (!item.availableFrom && !item.availableUntil) continue;
    const minutes = [0]; // Single-sided ranges also reset at the next local midnight.
    for (const [value, inclusiveEnd] of [[item.availableFrom, false], [item.availableUntil, true]] as const) {
      if (!value || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) continue;
      const [hour, minute] = value.split(":").map(Number);
      minutes.push(hour * 60 + minute + (inclusiveEnd ? 1 : 0));
    }
    for (const minute of minutes) {
      const date = new Date(now); date.setHours(0, minute, 0, 0);
      if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
      if (!next || date < next) next = date;
    }
  }
  return next;
}
